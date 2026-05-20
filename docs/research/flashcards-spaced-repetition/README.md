---
title: Flashcards & spaced repetition
issue: https://github.com/RonanCodes/lekkertaal/issues/178
wiki: llm-wiki-learn-dutch/flashcards-spaced-repetition
status: draft
last_updated: 2026-05-20
---

# Flashcards & spaced repetition

## Summary

Spaced repetition is the most evidence-backed technique for long-term vocabulary retention, with meta-analyses showing median effect sizes of d = 0.60 over massed practice ([Cepeda et al. 2006][cepeda2006]). The field has matured significantly since the SM-2 algorithm (1987): FSRS, an open-source ML-fit scheduler released in 2022 and adopted by Anki in November 2023, delivers 20-30% fewer reviews for the same retention rate by modelling memory with three independent variables (stability, difficulty, retrievability) instead of a single ease factor. Lekkertaal currently runs a simplified SM-2 variant with binary correct/incorrect grading; the evidence supports keeping binary grading but migrating the scheduling math to FSRS, capping daily new cards at 5-8 for a 5-minute session budget, and setting a desired-retention target of 85-90%.

---

## Findings

### Q1: Best-evidenced scheduling algorithm (SM-2 vs FSRS vs Leitner vs HLR)

#### Leitner boxes (1972)

Sebastian Leitner described the box system in his 1972 book "So lernt man Lernen" ([Leitner system, Wikipedia][leitner-wiki]). Cards advance through numbered boxes on correct recall and drop back on failure; each box has a fixed review interval (Box 1 daily, Box 2 every 2 days, Box 3 weekly, etc.). Strengths: simple, zero computation, embeds spaced-repetition and active-recall principles from day one. Weaknesses: no per-card difficulty tracking; fixed intervals ignore individual card hardness; does not scale gracefully beyond ~5 boxes; digital implementations often just encode fixed intervals without per-learner adaptation ([E-Student Leitner guide][e-student-leitner]).

#### SM-2 (1987)

Piotr Wozniak published SM-2 in his 1990 Master's thesis ([SuperMemopedia SM-2][supermemopedia-sm2]). The algorithm tracks a per-card "easiness factor" (EF, starting at 2.5) and updates it after each review using a quality grade 0-5:

```
EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
interval = interval × EF  (on correct, i.e. q ≥ 3)
interval = 1              (on failure, i.e. q < 3)
```

SM-2 dominated spaced-repetition software for 35 years because it was published openly and worked well at small card counts. Its main known defect is "ease hell": repeated hard grades push EF down toward the minimum (1.3), locking cards into short intervals permanently ([Mindomax algorithm comparison][mindomax]). A secondary issue is that the formula conflates three separate memory phenomena (per-item difficulty, current memory strength, and time since last review) into one scalar, producing scheduling errors that grow as a deck matures ([MemoForge FSRS vs SM-2 guide][memoforge]).

#### FSRS — Free Spaced Repetition Scheduler (2022)

FSRS was released by Jarrett Ye and the open-spaced-repetition community in September 2022 ([GitHub: open-spaced-repetition/free-spaced-repetition-scheduler][fsrs-github]). Anki adopted it as an opt-in option in version 23.10 (November 2023); benchmarks on 500+ million reviews show FSRS achieves 20-30% fewer reviews for equivalent retention versus SM-2 ([Mindomax FSRS vs SM-2][mindomax-fsrs]).

FSRS models three independent memory variables:

- **Stability (S)**: days for recall probability to decay from 1.0 to 0.9.
- **Difficulty (D)**: per-card hardness on a 1-10 scale, with mean reversion so cards cannot permanently collapse.
- **Retrievability (R)**: current recall probability, modelled as `R(t) = (1 + F·t/S)^C` where F = 19/81 and C = −0.5 ([Borretti FSRS in 100 lines][borretti]).

The next review interval is solved by inverting the R formula to the desired retention target:

```
I(R_d) = (S/F) × (R_d^(1/C) − 1)
```

This means intervals grow linearly with stability, not exponentially with an arbitrary multiplier. Failed cards get a calculated recovery interval rather than a reset to day 1, avoiding the frustrating restart cycles of SM-2 ([Domenic Denicola FSRS overview][domenic]).

FSRS has 21 trainable parameters (17 in v4) that are optimized to each user's review history — the optimizer needs roughly 1,000 reviews before per-user tuning becomes meaningful ([Migaku SRS 2026][migaku]).

#### Duolingo Half-Life Regression (HLR, 2016)

Settles & Meeder's 2016 ACL paper "A Trainable Spaced Repetition Model for Language Learning" ([Semantic Scholar][settles2016]) described half-life regression (HLR): a log-linear model that predicts each word's memory "half-life" from features (lag time, error history, word difficulty such as whether it is a cognate or irregular verb). Trained on 13 million Duolingo learning traces, HLR achieved a 45%+ reduction in recall-prediction error over simpler baselines. Duolingo's implementation, later branded "Birdbrain", uses this data-driven half-life to surface words "on the verge of being forgotten" and increased overall learning activity by 12% while nearly halving error rates ([Duolingo blog][duolingo-blog]).

HLR's core insight that word-level features (cognate status, morphological regularity) predict memory half-life is well-validated but the model is application-specific and was not released as a general library. The broader finding, that scheduling should be personalized to item features rather than relying on a universal ease factor, is directly reflected in FSRS's difficulty parameter.

#### Algorithm comparison summary

| Algorithm | Year | Memory model | Ease hell? | Personalization | Open library? |
|-----------|------|-------------|-----------|----------------|--------------|
| Leitner | 1972 | Binary boxes | No | None | N/A |
| SM-2 | 1987 | EF scalar | Yes | EF per card | Yes (public spec) |
| HLR (Duolingo) | 2016 | Log-linear half-life | No | Feature-weighted | No (internal) |
| FSRS v6 | 2022 | DSR (3-variable) | No | 21 ML params | Yes ([ts-fsrs][ts-fsrs]) |

**Verdict**: FSRS is the best-evidenced general-purpose open scheduler. It is grounded in the same Difficulty-Stability-Retrievability (DSR) theory as SuperMemo 17+, is validated on 700 million real reviews, and eliminates the structural defects of SM-2 while being available as an MIT-licensed TypeScript package ([ts-fsrs on npm][ts-fsrs]).

---

### Q2: Grading granularity — binary vs 4-button vs 0-5

Grading granularity is a contested area with more practical experience than controlled-trial evidence.

**SM-2's 0-5 scale**: Wozniak's original scale maps 0-2 to failure and 3-5 to success with varying ease adjustments. Anki simplified this to 4 buttons (Again / Hard / Good / Easy), where only "Again" counts as failure and the other three vary the ease update. FSRS maps the same 4 buttons to stability updates: Again triggers the failure formula; Hard, Good, and Easy scale the success formula with difficulty-weighted modifiers.

**The case for binary grading**: The "low-key Anki" / "Pass-Fail" community argument ([DigitalWords low-key Anki][digitalwords]) is that:
1. People are not accurate self-assessors — choosing between "Hard" and "Good" introduces noise without reliable signal ([Anki FAQ: what algorithm?][anki-faq]).
2. Four-button decisions performed hundreds of times per session create measurable cognitive fatigue.
3. SM-2's ease-hell vulnerability is significantly reduced when you remove the "Hard" button that triggers ease decay.

FSRS explicitly supports binary grading — Anki's FSRS documentation notes the scheduler works well with just Again and Good ([Anki deck options manual][anki-manual]).

**The case for 4-button grading**: Finer grading signals let the algorithm differentiate "I just barely recalled it" from "I recalled it effortlessly." FSRS's difficulty mean-reversion makes it robust against repeated Hard presses (unlike SM-2), so the ease-hell argument is weaker for FSRS users.

**Research perspective**: The 2017 study by Maas et al. on recall, reproduction, and restudy ([PMC5545031][maas2017]) found no significant difference in retention between different recall formats over a 1-week interval, suggesting that the act of attempting recall matters more than the precise rating given afterward. This supports the binary approach for low-friction apps.

**Verdict for Lekkertaal**: Binary correct/incorrect grading (as currently implemented) is well-suited for a 5-min/day mobile PWA. It minimizes decision fatigue, matches user mental models ("I got it" / "I didn't"), and is explicitly supported by FSRS. If migrating to FSRS, map `correct = true` to `Rating.Good` and `correct = false` to `Rating.Again`. Retain a future path to `Rating.Hard` for power users who want finer control.

---

### Q3: New-card introduction — pacing and caps

**The review-debt multiplier**: Each new card introduced today generates approximately 7 review repetitions over the following month ([MemoForge daily load guide][memoforge-load]). Anki's manual quantifies this directly: 20 new cards per day → ~200 daily reviews at deck maturity ([Anki manual][anki-manual]). Review debt is roughly linear at first and then becomes overwhelming as decks scale.

**Time-budgeted caps**: A practical heuristic published across multiple Anki guides (Migaku, MemoForge, Lean Anki):

| Session budget | New cards/day | Expected mature reviews/day |
|---------------|--------------|---------------------------|
| 5 min | 3-5 | 30-50 |
| 20 min | 5-8 | 50-80 |
| 40 min | 12-15 | 120-150 |

**Interleaving new cards and reviews**: Standard practice is to show due reviews first so the day's most time-sensitive material is always covered even if the session ends early. New cards fill remaining time. FSRS's scheduling respects this ordering naturally.

**Spacing the initial ramp**: For learners new to a deck, experts recommend starting at 5-10 new cards/day and increasing only after the review queue stabilizes ([Best Anki settings for language learning, Migaku][migaku-settings]). Rapid early introduction creates a workload cliff 3-4 weeks later.

**Optimal lag**: Cepeda et al.'s 2008 study ([Spacing Effects in Learning, Psychological Science][cepeda2008]) established that the optimal inter-study interval is roughly 10-20% of the desired retention interval for short retention periods, declining to 5-10% for retention over a year. For a 5-min/day app targeting 7-day retention, this suggests a first-review interval of 1 day is appropriate, with exponential growth thereafter — consistent with SM-2's and FSRS's first-interval defaults.

**Verdict for Lekkertaal**: A cap of 3-5 new cards per session is appropriate for a 5-min/day constraint. The current `DUE_BATCH = 3` for review cards is correct. New cards should be gated behind a separate daily cap (not currently enforced) and introduced only after all due reviews are shown.

---

### Q4: Active recall vs recognition for vocab retention

**The testing effect**: Roediger and Karpicke's 2006 landmark paper ([Test-Enhanced Learning, Psychological Science][roediger2006]) demonstrated that practice testing improves delayed retention by ~50% compared to repeated studying: students who tested repeatedly recalled ~80% of Swahili vocabulary after 1 week vs 33-36% for re-studiers. The critical mechanism is the retrieval attempt itself, not the feedback.

**Recall vs recognition**: Active recall (producing the answer from memory) is theoretically stronger than recognition (picking from options), because production requires a fuller memory trace. However:

- Adesope et al. (2017) meta-analysis found practice testing has effect size g = 0.61 over restudying, but did not find strong differences between recall formats ([Mindomax active-recall article][mindomax-recall]).
- Maas et al. (2017) found no significant difference between cued recall, reproduction, and re-study over a 1-week retention interval for aurally-presented word learning ([PMC5545031][maas2017]).
- Multiple-choice testing can also produce meaningful retention gains because recognition still requires an active retrieval process when distractors are carefully designed.

**For vocabulary specifically**: Karpicke and Roediger's paired-word studies showed that repeated testing produced large long-term effects even when no feedback was given during testing ([Critical Importance of Retrieval, Science][karpicke2008]). The act of attempting retrieval — even unsuccessfully — strengthens subsequent recall.

**Flashcard format implications**:
- Showing the Dutch word and asking for the English translation (production recall) is stronger than multiple-choice distractors ([Mindomax recall vs recognition][mindomax-recall]).
- Audio playback on the card back strengthens phonological memory traces, important for spoken Dutch.
- Short words are significantly easier to learn than long ones (2-syllable: 58% accuracy vs 4-syllable: 31%, [Maas et al.][maas2017]) — a relevant constraint for A1 vocabulary selection.

**Verdict for Lekkertaal**: Keep the current pattern of showing the Dutch word or phrase and requiring the learner to recall the English meaning (or vice versa). Avoid heavy reliance on multiple-choice formats for the core spaced-repetition queue. Where multiple-choice is used (e.g. `picture_choice` drill type), it functions as recognition-only and should be supplemented with production-recall cards in the SRS queue.

---

### Q5: How leading apps implement their schedulers in production

**Anki** ships SM-2 as the legacy default and FSRS as the opt-in modern algorithm since version 23.10 ([Anki FAQ][anki-faq]). Default new cards: 20/day. Default retention target: 90%. The FSRS optimizer runs on the user's local review history; the Anki manual explicitly warns against setting retention above 97% due to exponential workload growth ([Anki deck options][anki-manual]).

**Duolingo** uses Birdbrain, a production evolution of the 2016 HLR paper. It processes ~15 billion exercises per week, adapts to individual and word-level features, and schedules reviews to hit the "on the verge of forgetting" moment. Sessions run 3-5 minutes with streaks as the primary retention mechanism. Duolingo does not expose its SRS parameters to users ([Duolingo blog][duolingo-blog]).

**Memrise** uses a simpler interval ladder: 4h → 12h → 24h → 6d → 12d → 48d → 96d → 6 months. Incorrect answers reset to the first interval. "Difficult words" are flagged and reviewed more aggressively. The gamification layer (water-the-flower) is presented on top of this interval ladder ([Memrise SRS help][memrise]). This approach is closer to a fixed Leitner box than a per-card ease algorithm.

**Key production pattern across all three**: The SRS engine runs server-side and is opaque to users. User-facing presentation is about streaks, progress, and reward — not about scheduling math. This is deliberate: showing interval times or ease factors increases cognitive load and reduces engagement.

---

### Q6: Ideal scheduler for a 5-min/day Dutch learner

Based on the research above:

1. **Use FSRS semantics**: stability + difficulty + retrievability model eliminates ease hell and produces better-calibrated intervals. Even without per-user parameter optimization (which needs 1,000+ reviews), the default FSRS parameters outperform SM-2 because the model structure is sounder.

2. **Binary grading suits the format**: A 5-min/day mobile app should minimize friction. Two taps (knew it / didn't) is the right UX. Map to `Rating.Good` / `Rating.Again` in FSRS terms.

3. **Aggressive new-card cap**: At 5 minutes per day, 3-5 new cards is the ceiling before review debt becomes unmanageable within 4-6 weeks.

4. **85-90% desired retention**: The workload-retention curve ([FSRS4Anki optimal retention wiki][fsrs-retention]) shows diminishing returns above 90%. For a casual daily app, 87% is a pragmatic target — enough retention to feel progress, low enough to keep review sessions short.

5. **Reviews before new cards**: Always drain the due queue first. New cards only appear when the due queue is empty or the session has just started.

6. **Exploit word-level features (future)**: Duolingo's HLR showed cognates and regular forms are intrinsically easier. Building a difficulty prior from Dutch vocabulary properties (cognate flag, syllable count, grammatical class) would let FSRS start with better initial stability estimates rather than the same default for every card.

---

## Recommendations for Lekkertaal

Lekkertaal currently runs a simplified SM-2 variant in `src/lib/server/spaced-rep.ts`:
- Ease factor starts at 2.5, increments +0.1 on correct and decrements −0.2 on incorrect, clamped to [1.3, ∞).
- Interval multiplied by ease on correct; reset to 1 on incorrect.
- Binary grading (`correct: boolean`).
- `DUE_BATCH = 3`, `MAX_ACTIVE_REVIEWS = 200`.

### Recommendation 1: Migrate to FSRS (high priority, Phase 2)

Replace the SM-2 arithmetic in `recordReviewResult` with FSRS scheduling using [ts-fsrs][ts-fsrs] (`pnpm add ts-fsrs`). The package is MIT-licensed, typed, and supports ES modules on Cloudflare Workers.

The D1 schema already stores `easeFactor`, `intervalDays`, and `repetitions`. A FSRS migration would add `stability` (float) and `state` (enum: New/Learning/Review/Relearning) columns to `spaced_rep_queue`. Existing SM-2 rows can be migrated with a sensible seed: `stability = intervalDays`, `state = Review`.

Mapping the existing binary API to FSRS:
```ts
import { createEmptyCard, fsrs, Rating } from "ts-fsrs";
const scheduler = fsrs(); // uses FSRS default params

// On correct answer:
const { card } = scheduler.next(existingCard, now, Rating.Good);

// On incorrect answer:
const { card } = scheduler.next(existingCard, now, Rating.Again);
```

Binary grading maps cleanly to FSRS's Again/Good without exposing Hard/Easy to users. This is explicitly supported by the FSRS design ([DigitalWords][digitalwords]; [Anki manual][anki-manual]).

**Expected gain**: 20-30% fewer reviews for the same retention, meaning a 5-min session can cover more material without degrading recall.

### Recommendation 2: Add a daily new-card cap (high priority, Phase 2)

Currently there is no cap on new cards per session — a learner opening the app after a vocabulary import will get all due exercises plus unlimited new cards. Add a `dailyNewCardCount` counter (either in D1 or in a KV-backed session) and cap new-card introductions at 5 per day for the default profile.

This prevents the review-debt cliff that hits ~4 weeks in for enthusiastic early adopters.

### Recommendation 3: Set desired retention to 87% (medium priority)

FSRS's desired-retention parameter controls the scheduler's aggressiveness. 87% is appropriate for a casual daily app:
- Above 90%: workload grows rapidly for marginal retention gains.
- Below 80%: too many words drop out before consolidating.
- 87%: balances daily review time with perceptible learning progress.

This can be passed as a parameter to the FSRS scheduler: `fsrs({ requestRetention: 0.87 })`.

### Recommendation 4: Show reviews before new cards (low priority, easy win)

In `src/routes/app.lesson.$slug.tsx` (or wherever drills are queued for a session), ensure the ordering is: SRS due reviews → lesson exercises → new vocabulary introductions. Currently `getDueReviews` is fetched in the lesson loader; verify new cards are not interleaved before the due queue is drained.

### Recommendation 5: Add a cognate-difficulty prior (low priority, Phase 3)

Dutch-English cognates (water, hand, park, hotel) are intrinsically easier for English speakers. Flagging cognates in the vocabulary metadata and seeding FSRS with a lower initial difficulty (`D = 3` vs the default `D = 5`) would front-load the learning curve accurately. This is the most implementable lesson from Duolingo's HLR feature engineering.

### Recommendation 6: Keep binary grading — do not add Hard/Easy (explicit hold)

The evidence for finer grading adding value over binary for short-session mobile apps is weak. The cognitive cost of rating granularity in a 5-min session is real. Keep `correct: boolean`. If future A/B data shows meaningful signal from intermediate ratings, re-evaluate.

---

## Sources

1. **[SuperMemopedia: Algorithm SM-2][supermemopedia-sm2]** — Original SM-2 algorithm specification with formulas, easiness factor update equation, and 0-5 quality scale description.

2. **[Mindomax: Spaced Repetition Algorithms from SM-2 to FSRS][mindomax]** — Comparative deep-dive covering Leitner, SM-2, FSRS v3-6, HLR, Ebisu, and MEMORIZE with algorithm tables and benchmark results.

3. **[GitHub: open-spaced-repetition/free-spaced-repetition-scheduler][fsrs-github]** — FSRS reference implementation and DSR model documentation.

4. **[Domenic Denicola: Spaced Repetition Systems Have Gotten Way Better][domenic]** — Clear explanation of FSRS vs SM-2, three-component model, desired-retention tradeoffs, and workload simulation.

5. **[Settles & Meeder (2016), A Trainable Spaced Repetition Model for Language Learning (ACL)][settles2016]** — Half-life regression paper; 13 million Duolingo traces; 45% error reduction; word-level features (cognate, morphological regularity) as predictors.

6. **[Duolingo Blog: How We Learn How You Learn][duolingo-blog]** — Describes Birdbrain/HLR in production: signals used, 12% activity increase, nearly-halved error rate.

7. **[Roediger & Karpicke (2006), Test-Enhanced Learning, Psychological Science][roediger2006]** — Testing effect landmark study; repeated testing produced 50% better 1-week retention than repeated studying; 80% vs 33-36% Swahili recall.

8. **[Karpicke & Roediger (2008), The Critical Importance of Retrieval for Learning, Science][karpicke2008]** — Paired-word retrieval study; repeated testing produced large long-term effects even without feedback.

9. **[Cepeda et al. (2006), Distributed Practice in Verbal Recall Tasks (Psychological Bulletin)][cepeda2006]** — 839-assessment meta-analysis confirming spacing advantage (d = 0.60); optimal ISI scales with retention interval.

10. **[Cepeda et al. (2008), Spacing Effects in Learning, Psychological Science][cepeda2008]** — 1,350+ participants, gap up to 3.5 months; optimal ISI ≈ 10-20% of test delay for short retention, declining to 5-10% for long retention.

11. **[Maas et al. (2017), Effect of Recall, Reproduction, and Restudy on Word Learning, BMC Psychology][maas2017]** — Pre-registered study; no significant difference between cued recall, reproduction, and restudy for aurally-presented word pairs over 1-week follow-up; word length was the dominant predictor.

12. **[MemoForge: FSRS vs SM-2 Guide for Medical Students][memoforge]** — Ease hell explanation; benchmark table (135 vs 180 daily reviews at equal retention); FSRS elimination of ease hell via mean-reversion.

13. **[Anki Deck Options Manual][anki-manual]** — Official Anki documentation on new-card limits, FSRS desired-retention settings, and the workload curve above 90% retention.

14. **[GitHub: open-spaced-repetition/ts-fsrs][ts-fsrs-github]** — TypeScript implementation of FSRS; Card/Rating/State types; `createEmptyCard`, `fsrs()`, `scheduler.next()` API; supports ES modules, CommonJS, Cloudflare Workers.

15. **[Borretti: Implementing FSRS in 100 Lines][borretti]** — Minimal FSRS walkthrough: retrievability formula, stability update for success/failure, difficulty mean-reversion, and next-interval calculation.

16. **[Migaku: Spaced Repetition in 2026][migaku]** — Practical language-learner guide; 10-20 new cards/day sustainable cap; common pitfalls (retention > 95%, insufficient reviews before optimization).

17. **[MemoForge: Right-Sizing Daily Load (Anki new-card limits)][memoforge-load]** — Time-first new-card budgeting: 5-8 cards for 20-min sessions; review-debt accumulation math.

18. **[DigitalWords: Low-Key Anki (Binary Grading)][digitalwords]** — Binary pass/fail approach; subjective grading inaccuracy; decision fatigue; FSRS native support for Again/Good only.

19. **[Memrise SRS Help][memrise]** — Memrise interval ladder and difficulty-word resurfacing mechanic.

---

[supermemopedia-sm2]: https://www.supermemopedia.com/wiki/Algorithm_SM-2
[mindomax]: https://www.mindomax.com/spaced-repetition-algorithms
[mindomax-fsrs]: https://www.mindomax.com/fsrs-vs-sm2-spaced-repetition-algorithm
[mindomax-recall]: https://www.mindomax.com/Spaced-Repetition-vs-Active-Recall-for-Flashcard-Effectiveness
[fsrs-github]: https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler
[domenic]: https://domenic.me/fsrs/
[settles2016]: https://www.semanticscholar.org/paper/A-Trainable-Spaced-Repetition-Model-for-Language-Settles-Meeder/cb836d2b8e126dc31ded5e674d73021604dcc6e0
[duolingo-blog]: https://blog.duolingo.com/how-we-learn-how-you-learn/
[roediger2006]: https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2006.01693.x
[karpicke2008]: https://www.science.org/doi/abs/10.1126/science.1152408
[cepeda2006]: https://augmentingcognition.com/assets/Cepeda2006.pdf
[cepeda2008]: https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2008.02209.x
[maas2017]: https://pmc.ncbi.nlm.nih.gov/articles/PMC5545031
[memoforge]: https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/
[memoforge-load]: https://memoforge.app/blog/right-sizing-daily-load-anki-new-card-limits-ease-leech-settings/
[anki-manual]: https://docs.ankiweb.net/deck-options.html
[ts-fsrs]: https://www.npmjs.com/package/ts-fsrs
[ts-fsrs-github]: https://github.com/open-spaced-repetition/ts-fsrs
[borretti]: https://borretti.me/article/implementing-fsrs-in-100-lines
[migaku]: https://migaku.com/blog/language-fun/spaced-repetition-in-2026-how-it-actually-works
[migaku-settings]: https://migaku.com/blog/language-fun/anki-settings-for-language-learning
[digitalwords]: https://digitalwords.net/anki/low-key/
[memrise]: https://memrisebeta.zendesk.com/hc/en-us/articles/24998764126097-How-does-the-spaced-repetition-system-work
[leitner-wiki]: https://en.wikipedia.org/wiki/Leitner_system
[e-student-leitner]: https://e-student.org/leitner-system/
[anki-faq]: https://faqs.ankiweb.net/what-spaced-repetition-algorithm
[fsrs-retention]: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention
