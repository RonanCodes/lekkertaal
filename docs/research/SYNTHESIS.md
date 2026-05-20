---
title: Lekkertaal pedagogy + branding research — synthesis & product plan
issue: https://github.com/RonanCodes/lekkertaal/issues/172
status: draft
last_updated: 2026-05-20
inputs:
  - ./evidence-based-sla/README.md
  - ./flashcards-spaced-repetition/README.md
  - ./quiz-assessment-design/README.md
  - ./duolingo-teardown/README.md
  - ./babbel-teardown/README.md
  - ./structured-course-methods/README.md
  - ./branding-visual-identity/README.md
---

# Synthesis: what the research says Lekkertaal should build

Seven research tasks (umbrella [#172](https://github.com/RonanCodes/lekkertaal/issues/172)) ran as an AFK swarm on 2026-05-20, each producing a cited doc (110+ sources total). This synthesis consolidates them into a product direction + a draft-PRD map for Phase 2.

## The single strongest signal: a real spaced-repetition engine

**Six of the seven docs independently converge on this.** Lekkertaal's current `src/lib/server/spaced-rep.ts` runs a simplified SM-2 with binary grading, `DUE_BATCH=3`, no daily new-card cap, and no cross-session "review session" surface.

- Evidence-based SLA: spacing effect is one of the 7 load-bearing principles (Cepeda 2006; Kim 2022 meta-analysis).
- Flashcards/SRS: migrate SM-2 → **FSRS** (`ts-fsrs`, MIT, Workers-compatible) for ~20-30% fewer reviews at equal retention; binary grading maps cleanly to FSRS `Again`/`Good`; add stability+state columns; target 87% retention; add a daily new-card cap of 3-5.
- Duolingo teardown: cross-session SRS is the **#1 missing mechanic** and the clearest ROI (their HLR A/B showed 9.5-12% retention gains).
- Quiz design: schedule reviews by SM-2/FSRS targeting 85-90% correct-at-review.
- Babbel: a distinct review queue (new/learning/known buckets) is what makes return sessions feel purposeful.
- Structured courses: SRS-driven drill layer with expanding intervals (5min → 1d → 4d → 2w → 6w → 6mo).

→ **Draft PRD #1: FSRS spaced-repetition engine.**

## Second signal: wrap drills in a structured lesson arc

Today drills are presented somewhat flat. Babbel + structured-courses + quiz-design converge on a **scaffolded arc**:

1. **Vocab intro** (3-5 items, audio + image + word-in-sentence context)
2. **Grammar callout** (one brief, relevant rule, shown after first exposure not front-loaded)
3. **Drill set** (5-8 exercises, recognition → production order, interleaved drill types)
4. **Capstone dialogue** (`dialogue_reply` / boss-fight as the pushed-output finale — already the right structure)

Plus: CEFR can-do descriptors as the unit skeleton (not grammar lists); frequency-first vocab (top 2,500 Dutch words, spiral reuse); Assimil's passive→active timing (2-3 sessions between exposure and production demand).

→ **Draft PRD #2: structured lesson-arc + adaptive sequencing** (folds in interleaving, recognition-first sequencing, the 15-25% error-rate target, and the 3x-fail format-fallback from the quiz doc).

## Third signal: gamification v2 (cheap, evidence-backed wins)

Lekkertaal already has streaks/freezes/coins/leagues/daily-quests (the core loop). The teardowns surface specific, measured additions:

- **Streak freeze 1 → 2 equipped** — +0.38% DAU in Duolingo's own experiment. Near-zero build cost. (Quick win.)
- **Streak wager** (bet coins on a 7-day streak) — commitment device, +14% D14 retention.
- **Achievement badges** (7-day streak, first boss-fight, first promotion…) — +116% friend-adds side effect.
- **Notification copy A/B → bandit** — relevance >> frequency; personalise to revision debt, not generic "practice Dutch".
- Guard intrinsic motivation (SDT): don't let a streak survive on trivially-replayed mastered material; offer meaningful choice (autonomy).
- **Skip** hearts/energy paywall (backlash risk, no revenue pressure).

→ **Draft PRD #3: gamification v2.**

## Fourth signal: grammar reference + inline tips

Babbel added a Grammar Guide only after 36% user dissatisfaction; structured-courses + evidence-SLA both back brief, error-triggered explicit grammar over front-loaded rules.

- A `/grammar` reference section organised by CEFR level (A1-B1), one-sentence rule + table + 2-3 examples per page, linked from every drill exercising that pattern.
- Error-triggered grammar cards (30-60s), optional "Why?" disclosure on any feedback screen.

→ **Draft PRD #4: grammar reference + inline tips.**

## Fifth signal: the fun rebrand

The branding research + the `/styleguide` exploration (#186) give a concrete palette + mascot family:

- **Palette:** Stroopwafel Gold `#E8A020` (primary), Waffle Tan `#C47A2B`, Tulip Green `#3DB34A` (progress), Dutch Navy `#1E2D40` (text), Poffertje White `#FAF7F0` (surface), + Bitterbal Orange / Drop Red / Syrup Amber accents + dark-mode variants. All WCAG-rated.
- **Mascot family:** Stroop (stroopwafel, primary mentor), Bitta (bitterballen, social sidekick), Dropje (licorice, boss-fight trickster), Olie (oliebol, celebration-only). Mascots appear at emotional peaks only (Mailchimp Freddie rule), never in error/loading UI.
- Micro-animation: Rive for interactive mascot states, Lottie for one-off celebrations, CSS for micro-UI.

→ **Draft PRD #5: fun rebrand rollout** (adopt one palette from the `/styleguide`, wire the mascot family in at emotional peaks).

## Draft PRD map

| PRD | Drives from | Priority | Risk |
|---|---|---|---|
| #1 FSRS spaced-repetition engine | flashcards, evidence-SLA, Duolingo, quiz, Babbel, structured | **Highest** (6/7 convergence) | Schema migration (D1) |
| #2 Structured lesson-arc + adaptive sequencing | Babbel, structured, quiz, evidence-SLA | High | Large; touches lesson engine |
| #3 Gamification v2 | Duolingo, evidence-SLA | Medium (has quick wins) | Low |
| #4 Grammar reference + inline tips | Babbel, structured, evidence-SLA | Medium | Content authoring cost |
| #5 Fun rebrand rollout | branding-visual-identity, #186 styleguide | Medium | Visual; needs human taste review |

## Cross-cutting principles (the spine for all PRDs)

1. Retrieval before re-exposure (no "show first" flows).
2. Spaced scheduling tied to the forgetting curve (FSRS).
3. Interleave drill types within sessions.
4. Pushed output + corrective feedback (boss-fights are the crown jewel).
5. Comprehensible input + form-noticing cues.
6. Autonomy + competence loop; protect intrinsic motivation.
7. Brief, error-triggered explicit grammar — never front-loaded.

## See also

- Umbrella issue [#172](https://github.com/RonanCodes/lekkertaal/issues/172)
- The 7 source docs (linked in front-matter + the [index](./README.md))
- Wiki mirror: `llm-wiki-learn-dutch` (ingested 2026-05-20)
