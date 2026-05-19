---
title: "Duolingo teardown"
issue: https://github.com/RonanCodes/lekkertaal/issues/180
wiki: llm-wiki-learn-dutch/duolingo-teardown
status: draft
last_updated: 2026-05-20
---

# Duolingo teardown

Gamification, lesson structure, and retention mechanics of Duolingo. Research commissioned to inform Phase 2 feature decisions for Lekkertaal.

## Child docs

- [gamification.md](./gamification.md) — streaks, XP, leagues, hearts/energy, daily quests, badges, social layer
- [lesson-structure.md](./lesson-structure.md) — path hierarchy, lesson anatomy, exercise types, spaced repetition structure
- [retention-mechanics.md](./retention-mechanics.md) — Birdbrain/HLR model, notifications, A/B testing culture, DAU decomposition

---

## Summary

Duolingo's product success comes from three interlocking systems operating at different timescales:

1. **Habit formation (daily):** Streaks, a low daily minimum ("one lesson"), and timed notifications create a daily ritual. Loss aversion keeps the ritual sticky once established.
2. **Session quality (per-lesson):** Adaptive exercise selection via Half-Life Regression (Birdbrain) ensures each session surfaces the words most at risk of being forgotten, making practice feel efficient rather than arbitrary.
3. **Competitive engagement (weekly):** Leagues with promotion and demotion add a second loss-aversion axis. Demotion risk is visible to more users than promotion opportunity, so it acts as a consistent mid-week re-engagement driver.

Monetisation (hearts/energy system) is deliberately decoupled from the retention loop. Free users can access the full retention stack. The paywall limits learning speed, not participation in the habit-forming mechanics.

---

## Findings

### 1. Lesson structure

Duolingo's content hierarchy: Sections (CEFR-aligned) > Units (thematic, ~10 levels each) > Levels (nodes on the path) > Lessons (up to 17 exercises, 3-5 minutes). See [lesson-structure.md](./lesson-structure.md) for full details.

Each lesson adapts in real time: strong performers get harder exercises at the end; users who make mistakes replay those items before closing. Units end with an optional 8-level challenge; only the first level is required to progress.

Exercise types span translation, word bank, listening, pronunciation, picture matching, and fill-in-the-blank. Popular courses have the widest variety.

Stories (narrative input) are embedded at specific path points; in 2025 they expanded to 100+ courses.

### 2. Gamification stack

**Streaks** are the primary retention lever. DAUs doubled from 16M to 30M between 2021 and 2023. Nine million users maintain year-long streaks. Switching from XP-based to lesson-based streak criteria drove the largest single DAU jump.

**Streak Freeze:** allowing two equipped freezes (up from one) raised daily active learners by +0.38%. Users with freeze access average 17.19 streak days vs 11.62 without (48% gap).

**Leagues:** tiered weekly leaderboards (Bronze to Diamond) with promotion and demotion. Adding leagues on iOS increased lesson starts and completions. The demotion threat re-engages the middle of the leaderboard throughout the week.

**Daily Quests:** three quests per day, refreshing daily. Quest completion unlocks XP boosts (bronze 1.5x, silver 2x, gold 3x) and gems. Daily quests launched in 2022; DAUs increased 25%.

**Badges:** launching the badge system produced a 2.4% DAU increase, 4.5% more completions, and — unexpectedly — a 116% increase in friends added. Achievement badges outperform participation badges.

**Hearts/Energy (monetisation):** Hearts (5 lives, mistakes reduce them) have been replaced by an energy system (25 points, each question costs 1 regardless of correctness). Both gate practice volume for free users; Super/Max removes the limit. This is the paywall mechanism, not a retention mechanic.

**Wager mechanic:** streak wagers (bet gems on maintaining a streak) produced 14% higher day-14 retention. Commitment devices work.

Full analysis: [gamification.md](./gamification.md).

### 3. Streak psychology and loss aversion

Loss aversion (Kahneman and Tversky): losses feel roughly twice as painful as equivalent gains. Applied to streaks: protecting a 100-day streak is not about 101; it is about not losing 100.

Early streaks use **relative growth** (day 2 to 3 = 50% increase) to build momentum. Later streaks activate **identity anchoring** (the streak becomes a personal trophy) and pure loss aversion.

The system is deliberately "sticky but humane": streak freezes, grace periods, and weekend amulets add slack that prevents burnout-driven abandonment while maintaining the pressure mechanism.

University of Pennsylvania/UCLA research cited internally: providing "slack" increases persistence.

A/B test result: Weekend Amulet feature raised D7 retention by +2.1% and D14 retention by +4%.

Full analysis: [retention-mechanics.md](./retention-mechanics.md).

### 4. Birdbrain and the half-life regression model

HLR (Half-Life Regression) is Duolingo's core memory model, published by Burr Settles and Brendan Meeder (ACL 2016). It estimates each word's "half-life" in a learner's memory using an exponential decay function trained on billions of practice sessions.

The student model updates 3,000 times per second. It identifies individual weakest words, adjusts for word-level difficulty (cognates easy, irregular forms hard), and surfaces review lessons in the path when recall probability falls below threshold.

A/B test results vs prior Leitner system:
- 45%+ reduction in prediction error
- 9.5% improvement in practice-session retention
- 12% improvement in overall activity retention

In 2025 Birdbrain personalises 1.25 billion exercises per day. It now combines HLR with bandit algorithms (exercise selection) and GPT-4 (boss fight / video call AI roleplay).

Full analysis: [retention-mechanics.md](./retention-mechanics.md).

### 5. Notifications and re-engagement

The notification engine uses a **bandit algorithm**: it selects from a pool of pre-written templates, learning which messages drive lesson completions for each user/language segment.

Key findings from analysis of ~200 million reminders over 34 days:
- Notification effectiveness is language-specific.
- Novelty decays (same message, diminishing returns); Duolingo spaces template repetitions using the forgetting curve.
- The winning notification variant ("Hi, it's Duo") generated +5% DAUs.
- Notification interval: 23.5 hours (not 24) — prevents time-anchoring and the habit of ignoring a predictable time slot.

The famous passive-aggressive owl copy ("Your streak is at risk", character-voiced guilt messages) is A/B-tested. Only high-performing templates enter the permanent pool; the rest are discarded. Full analysis: [retention-mechanics.md](./retention-mechanics.md).

---

## Recommendations for Lekkertaal

Lekkertaal already has: streaks, streak freezes, coins (equivalent to gems), leagues, and daily quests. That covers the core retention loop.

### What is missing

| Gap | Duolingo equivalent | Priority | Notes |
|---|---|---|---|
| **Spaced repetition across sessions** | Birdbrain / HLR review lessons | High | Lekkertaal does not surface review drills based on forgetting curves. Implementing even a simple SM-2 or HLR-lite model for vocab would lift retention measurably. The A/B results (9.5-12% retention gain) are the clearest ROI in this research. |
| **Streak wager / commitment device** | Gem-bet mechanic | Medium | Users bet coins that they will maintain a streak. Commitment devices demonstrably raise 14-day retention. Low implementation cost vs impact. |
| **Badges with achievement value** | Personal Records + Awards | Medium | Lekkertaal has coins and streaks but no trophy/badge system. The surprise finding (116% increase in friend adds) suggests social amplification beyond the badge itself. |
| **Notification bandit algorithm** | Bandit-selected push copy | Medium | Lekkertaal sends push notifications but likely with static templates. A/B-testing copy per user segment (Dutch learners vs general) and gradually building a winning pool would compound over time. Starting point: test 3 message variants, pick the winner after 2 weeks. |
| **Social: friend streaks / friend quests** | Friend streaks + Friend Quests | Low-Medium | Co-op challenges are a natural extension of the existing league system. High implementation cost but strong social retention signal. |
| **Lesson-level adaptive endings** | Hard exercise tail / mistake replay | Low | Within-lesson adaptation is already present in Lekkertaal's drill engine. Worth auditing whether mistakes are replayed before session close; Duolingo's pattern is proven. |
| **Duo Score / shareable progress metric** | Duolingo Score (2025) | Low | A quantified, shareable Dutch proficiency score. Strong social proof signal but Phase 2+ scope. |

### What to copy directly

- **Streak Freeze quantity:** Two equipped freezes outperform one. If Lekkertaal currently allows one freeze, raising it to two is a low-risk, measurable DAU experiment.
- **"One lesson" minimum streak rule:** If Lekkertaal streaks still require XP targets, switching to "complete any drill" removes friction and should raise streak survival rates.
- **Milestone animations at day 7:** The +1.7% new-learner retention bump at the 7-day mark is from a visual enhancement only, not a new mechanic. Easy to implement.
- **Demotion visibility in leagues:** Duolingo shows demotion risk prominently, not just promotion opportunity. If the Lekkertaal league UI only shows the top, consider also showing the relegation zone to reactivate mid-table users.

### What to skip (or defer)

- **Hearts / energy system:** This is a monetisation gate, not a retention mechanic. Lekkertaal has no evidence it needs to throttle free learning volume. The backlash from Duolingo's 2025 energy rollout (users quitting, negative press) is a warning. Skip unless there is a direct revenue motivation.
- **GPT-4 video call / boss fight AI roleplay:** Lekkertaal already has AI roleplay scenarios. Investing in video call mechanics is scope-heavy. Defer to Phase 3+.
- **League tier count (10 tiers):** Duolingo's 10 leagues (Bronze to Diamond) may be more tiers than needed for Lekkertaal's current user base. Start with fewer, expand once the active competitive cohort warrants it.

### Experiment queue (prioritised)

1. **Streak freeze quantity:** Change from 1 to 2 equipped. Measure D7 and D14 streak survival.
2. **Streak wager:** Let users bet coins on a 7-day streak. Measure D14 retention vs control.
3. **Spaced repetition review sessions:** Surface "review drill" sessions when vocab recall probability drops (even a simple time-based heuristic as a precursor to full HLR). Measure session completion rate and 30-day retention.
4. **Notification copy A/B test:** Run 3 message variants across the Dutch-learner segment. Measure lesson completion within 1 hour of notification.
5. **Achievement badges:** Ship a small set (7-day streak, first lesson, first boss fight, first league promotion). Measure D30 retention and friend adds.

---

## Sources

1. Settles, B. and Meeder, B. (2016). "A Trainable Spaced Repetition Model for Language Learning." ACL 2016. https://research.duolingo.com/papers/settles.acl16.pdf — The original HLR paper; primary source for Birdbrain's statistical foundation.

2. Duolingo Engineering Blog. "How we learn how you learn." https://blog.duolingo.com/how-we-learn-how-you-learn/ — Official explanation of the HLR student model, 3,000 updates/second, forgetting curve basis, A/B test results vs Leitner.

3. Duolingo Engineering Blog. "How Duolingo streak builds habit." https://blog.duolingo.com/how-duolingo-streak-builds-habit/ — Streak design philosophy, loss-aversion framing, two-phase motivation model, freeze impact data, 3.6x engagement multiplier.

4. Duolingo Engineering Blog. "Hi, it's Duo: the AI behind the meme." https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/ — Bandit algorithm for notification selection, 200M reminder analysis, language-specific effectiveness, novelty decay.

5. Duolingo Engineering Blog. "Improving Duolingo, one experiment at a time." https://blog.duolingo.com/improving-duolingo-one-experiment-at-a-time/ — Experimentation culture, leaderboards experiment, offline promo shutdown, metrics tracked.

6. First Round Review. "The Tenets of A/B Testing from Duolingo's Master Growth Hacker." https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/ — Gina Gotthilf's framework: delayed sign-up (+20% DAUs), badge results (+116% friend adds), notification timing (23.5 hours), growth-mindset coach (+7.2% D14).

7. Deconstructor of Fun. "Duolingo: How the $15B App uses Gaming Principles to Supercharge DAU Growth." (April 2025) https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth — League mechanics, XP boost design, monetisation vs retention decoupling, 9M year-long streak users.

8. Trophy.so. "Duolingo Gamification Strategy: A Full Case Study (2026)." https://trophy.so/blog/duolingo-gamification-case-study — Gamification framework, churn reduction (47% to 28%), retention mechanics independence from monetisation.

9. StriveCloud. "Duolingo gamification explained." https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo — Psychological principles table (loss aversion, competence, social status, progress visualisation), streak wager +14% D14 retention.

10. JustAnotherPM. "The Psychology Behind Duolingo's Streak Feature." https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature — Identity anchoring, DAU doubling 2021-2023, streak-to-revenue correlation.

11. Duoplanet. "Duolingo Units and Checkpoints." https://duoplanet.com/duolingo-units-and-checkpoints/ — Checkpoint format (old and new), unit challenge structure, unit size comparison.

12. Duoplanet. "The Duolingo Learning Path." https://duoplanet.com/duolingo-learning-path/ — Path hierarchy (sections/units/levels/lessons), 17-question lesson format, adaptive lesson endings.

13. Duolingo Research. "A Sleeping, Recovering Bandit Algorithm for Optimizing Recurring Notifications." KDD 2020. https://research.duolingo.com/papers/yancey.kdd20.pdf — Formal treatment of the bandit notification system with novelty-decay handling.

14. nLytics. "The A/B Testing Playbook That Turned Duolingo Into A Global Phenomenon." https://nlytics.io/resources/blog/The-AB-Testing-Playbook-That-Turned-Duolingo-Into-A-Global-Phenomenon — 2,000+ experiments over 3 years, hundreds simultaneous weekly, 2024 Android results (47.7M DAUs).

15. Duolingo Blog. "2025 Duolingo Product Highlights." https://blog.duolingo.com/product-highlights/ — 172 new courses, Duo Score, Video Call with Lily, flashcard exercises, DuoRadio expansion.
