---
title: "Duolingo lesson structure"
parent: duolingo-teardown/README.md
last_updated: 2026-05-20
---

# Duolingo lesson structure

## Path hierarchy

The current learning path (redesigned 2022) organises content in four levels:

1. **Sections** — aligned with CEFR proficiency bands (A1, A2, B1, B2...). Each section contains multiple units.
2. **Units** — thematic clusters (e.g. "Ordering food", "Travel"). Units are smaller than the original tree's skills. Arabic has 30 units; larger courses have more. Each unit ships with a guidebook covering grammar and vocabulary.
3. **Levels** — individual stepping stones within a unit, displayed as icon nodes on the path. A unit typically contains around 10 levels.
4. **Lessons** — the practice sessions within a level. Up to 17 questions per lesson.

## Lesson anatomy

A standard lesson contains up to 17 exercises. Exercise types include:

- Translation (L1 to L2 and L2 to L1)
- Word bank (tap-to-select word tiles)
- Listening and transcription
- Pronunciation / speaking
- Reading comprehension
- Picture matching
- Fill-in-the-blank

Popular courses (French, Spanish) have the widest exercise variety. Smaller courses offer fewer types.

Performance-adaptive endings: if a user performs well, the lesson closes with one or two harder exercises. If the user makes mistakes, those items reappear for review at the end. This is a lightweight within-session spaced repetition pass.

## Unit endings

Each unit closes with a challenge of up to 8 levels. Only the first level of the challenge is required to unlock the next unit; the remaining levels are optional practice. This replaced the old checkpoint quiz format.

Old checkpoint format (for context): roughly 30 questions, no hints, 4 hearts, wrong answers did not replay at the end.

## Spaced repetition across sessions

Duolingo's Birdbrain system (see retention-mechanics.md) intervenes between sessions, not within them. The lesson path will surface review lessons — older material inserted into the path — when the system predicts recall has decayed below a threshold.

The path is non-linear in this sense: a user's active node might be in Unit 8 while a unit 3 review lesson surfaces in the queue because the half-life regression has flagged those words as at-risk.

## Lesson length and pacing

A typical lesson takes 3-5 minutes. Duolingo deliberately keeps lessons short to lower the activation energy for the daily habit. The minimum viable practice session ("just one lesson") satisfies the streak requirement, making it psychologically easy to start even on low-energy days.

## Stories

Stories are narrative exercises embedded at specific units in the path. They provide input-rich, contextual reading and listening practice distinct from the exercise-based lessons. In 2025 Duolingo added stories to 100+ courses at Duolingo Score 30-59.

## Guidebooks

Each unit includes a guidebook explaining the grammar and vocabulary covered. This is the closest Duolingo comes to explicit instruction; the rest of the path favours implicit learning through repetition and context.

## Content scale (2025)

- 172 new language courses launched in 2025 (28 languages), the largest single content expansion.
- 100,000+ DuoRadio episodes (input listening at various levels).
- Flashcard exercises for top languages using active recall.
- 60 new math units (grades 6-9) and beginner piano — expansion beyond language learning.
