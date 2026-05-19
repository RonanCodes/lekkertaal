---
title: "Duolingo retention mechanics"
parent: duolingo-teardown/README.md
last_updated: 2026-05-20
---

# Duolingo retention mechanics

## Birdbrain and half-life regression

Duolingo's adaptive learning engine is called Birdbrain. Its core model is **Half-Life Regression (HLR)**, developed by Burr Settles and Brendan Meeder (published ACL 2016: "A Trainable Spaced Repetition Model for Language Learning").

**Concept:** Every word has a "half-life" — the time until the learner has a 50% probability of forgetting it. HLR uses an exponential decay function rooted in Ebbinghaus's 1885 forgetting curve, but unlike fixed-schedule spaced repetition (e.g. Leitner boxes), HLR trains on billions of actual user responses to personalise each learner's memory model.

The student model updates 3,000 times per second across all active learners. For each word it tracks:
- Time since last practice
- Number of previous exposures
- Historical error rate on that word
- Word-level difficulty (cognates are easy; irregular past participles are hard)

**Results from A/B testing HLR vs the prior Leitner system:**
- 45%+ reduction in prediction error
- 9.5% improvement in practice-session retention
- 12% improvement in overall activity retention

**Birdbrain scope (2025):** Personalises 1.25 billion exercises per day. Combines HLR for recall prediction with bandit algorithms for exercise selection and GPT-4 for AI roleplay scenarios (boss fight / video call modes).

## Spaced repetition mechanics

Core principle: short, spaced practice over time beats cramming. The "lag effect" — gradually increasing intervals between review sessions — further improves long-term retention over uniform spacing.

Duolingo operationalises this at two levels:

1. **Within-lesson:** Missed items replay at the end of the lesson session.
2. **Between-sessions:** Birdbrain surfaces review lessons in the path when recall probability drops below a threshold. These appear as dedicated review nodes, not silently mixed into new content.

## Notifications and re-engagement

### Bandit algorithm for notification selection

Duolingo does not choose notification copy randomly. A bandit algorithm (a form of reinforcement learning) selects from a pool of pre-written templates. The "payout" signal is whether the user completes a lesson after receiving the notification.

Key findings from analysis of ~200 million practice reminders over 34 days:
- Notification effectiveness varies by target language: "Time for [language]" works well for Chinese learners but not English learners.
- Novelty decays: the same message drives diminishing engagement over time. Duolingo applies the same forgetting-curve logic to notification templates — spacing out repetitions of the same message.
- The most personalised variant ("Hi, it's Duo") won A/B tests and produced a 5% DAU increase.

### Notification timing

Duolingo settled on 23.5-hour intervals between practice reminders (not exactly 24 hours). This means the reminder drifts slightly earlier each day, which prevents it from anchoring to a specific time that might become inconvenient and reducing the chance a user conditions themselves to ignore a notification at a fixed clock time.

Users set a preferred reminder time; the system personalises around that anchor.

### Passive-aggressive copy strategy

Duolingo's notifications are famous for guilt-framing ("Your streak is at risk", "You haven't practiced today", character-voiced messages). This is deliberate: the messages tap into commitment and social accountability. However, the strategy is carefully tested. The team runs every new notification template on a small user group before adding it to the permanent pool.

### Weekend Amulet

A feature protecting streaks through weekends. A/B test result: +2.1% D7 retention, +4% D14 retention.

## A/B testing culture

Scale: 2,000+ experiments launched over three years; hundreds run simultaneously each week. In 2024 alone the Android performance team ran 200+ tests.

Key tested mechanics and results:

| Experiment | Result |
|---|---|
| Delayed sign-up (sampling before registration) | +20% DAUs |
| Soft walls (optional sign-up prompts) | Additional +8.2% DAUs |
| Badge system v1 | +2.4% DAUs, +116% friend adds |
| Leaderboards (iOS) | Increased lesson starts and completions |
| In-app coach growth-mindset messaging | +7.2% D14 retention |
| Weekend Amulet | +2.1% D7, +4% D14 |
| "Hi, it's Duo" notification | +5% DAUs |
| Plus offline purchase prompt | Slight revenue up, retention down — shut down |

The offline promotion experiment is instructive: Duolingo chose to kill a revenue-positive feature because it hurt retention. The company's operating principle is that long-term DAU growth produces more revenue than short-term conversion pressure.

Testing guidelines used internally:
- Minimum 1% improvement threshold for mature products (20-30% for new features)
- At least ~100,000 DAU for statistical validity
- Maximum 3 conditions per experiment (control + 2 variants)

## DAU decomposition model

Gina Gotthilf (former VP Growth) describes Duolingo's growth model as a decomposition of DAU into movable sub-metrics: new users, reactivated users, retained users. Each experiment is mapped to which sub-metric it targets before running. This focus helped 4x DAUs from 2019 to 2024.

Current scale (2025): 47.7 million DAUs, 10.9 million paid subscribers.

## Performance as a retention lever

Duolingo's Android team treated app performance (not just features) as a retention experiment. Results from 200+ performance A/B tests in 2024:
- Entry-level device app-open conversion: 91% to 94.7%
- Users experiencing 5+ second load times: 39% down to 8%

These are attributed to "hundreds of thousands" of DAU gains. Fast app = fewer drop-offs before the habit loop fires.
