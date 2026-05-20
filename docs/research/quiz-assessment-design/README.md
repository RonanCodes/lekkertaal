---
title: "Quiz & assessment design"
issue: https://github.com/RonanCodes/lekkertaal/issues/179
wiki: llm-wiki-learn-dutch/quiz-assessment-design
status: draft
last_updated: 2026-05-20
---

# Quiz & assessment design for language learning

## Summary

Language learning retention is strongest when learners are required to actively retrieve information under slightly effortful conditions (retrieval practice / desirable difficulties), rather than passively recognising it. Production-format drills (type-the-answer, dictation, cloze) consistently outperform pure recognition formats (MCQ, matching) on delayed retention tests, though MCQ still beats no practice at all. Immediate corrective feedback wins for engagement; the learning-outcome advantage of immediate over delayed feedback is real but modest for most drill types. Adaptive difficulty should target the 80-90% correct-response zone: easy enough to stay motivating, hard enough to keep memory traces strong. Spaced repetition intervals should grow by roughly 2.5-3.5x after each correct response, with a target retrievability of ~90% at review time.

Lekkertaal already has 10+ drill types. The priority task is not adding new formats but sequencing existing ones correctly: begin each lesson arc with higher-recognition drills (picture-choice, multiple-choice, word-bank), progress within a session to production drills (translation-typing, listening-spell, fill-blank, conjugation), and use dialogue-reply / roleplay as the capstone "pushed output" exercise. Flashcard review should be scheduled by a spaced-repetition algorithm (SM-2 or FSRS), not on a fixed rotation.

---

## Findings

### 1. Question format efficacy: production vs recognition

The research consistently places formats on a spectrum from pure recognition (multiple-choice, matching, picture-choice) through scaffolded production (word-bank, fill-blank / cloze) to free production (translation-typing, listening-spell, conjugation, dialogue-reply).

**Recognition formats** — MCQ and matching — are the easiest for learners and produce strong short-term performance. A 2024 controlled study (Little & Bjork, UCLA replication) found MCQ practice yielded 73.9% correct on the practice test vs 58.6% for very-short-answer questions, a 15-point gap. On the _delayed_ retention test that gap shrank to 13 points and neither format produced a statistically significant difference (F(1,44)=3.23, p=0.08) [S1]. The key implication: MCQ is _not_ wasted — it builds recognition pathways — but free production practice produces better transfer and spontaneous use.

**Cued recall / short-answer** formats (cloze, fill-blank) occupy the middle ground. Research by Bjork's lab on vocabulary learning shows that requiring learners to predict answers before seeing them — the "generation effect" — produces stronger final-test performance than passive study. Randomly-ordered word lists (semantic mixing) further increase desirable difficulty [S5].

**Free production** (translation-typing, listening-spell) incurs the highest initial error rate but the strongest long-term encoding. Studies of L2 vocabulary learning find cued-recall practice "leads to better long-term retention compared to other practice types" [S3]. Dictation specifically integrates auditory discrimination, orthographic encoding and vocabulary recall simultaneously, making it one of the highest-value formats per minute of study time [S12].

**Word-bank drills** sit between cloze and MCQ: they remove the generation burden but still require ordering or slot-selection rather than merely recognising a letter. They are a good scaffolding step before free-production. No direct head-to-head comparison of word-bank vs free production was found; the cloze literature suggests that free recall still wins at transfer, but word-bank may better serve beginners.

**Picture-choice** drills rely on dual coding: combining visual and verbal inputs creates two memory traces [S8]. Paivio's dual coding theory (1970s, widely replicated) shows well-designed image + word pairings reduce cognitive load by 30-50% vs text-only. However, the benefit is conditional on the image being unambiguous and not splitting attention between competing stimuli [S8].

**Ranking by evidence** (delayed retention, not immediate performance):
1. Free production: translation-typing, listening-spell, conjugation (highest transfer)
2. Scaffolded production: fill-blank/cloze, dialogue-reply
3. Word-bank (scaffolded recognition-production hybrid)
4. Picture-choice, multiple-choice with good distractors
5. Matching (good for receptive vocabulary, low transfer to productive use)

This is a ranking of _retention value_, not _suitability for all learners_. For absolute beginners, starting with recognition formats and laddering up is more pedagogically sound than throwing them straight into free production.

---

### 2. Desirable difficulties: the optimal error rate

Robert Bjork coined "desirable difficulties" in 1994 to describe learning conditions that slow immediate performance but strengthen long-term retention and transfer [S4, S6]. The five core types relevant to quiz design are:

1. **Spacing** — reviewing content at increasing intervals rather than massing it. Research shows 200-400% improvement in retention vs massed practice [S9].
2. **Interleaving** — mixing question types and vocabulary sets within a session rather than blocking by topic. Produces 30-40% improvement on transfer tests even though it feels harder [S6].
3. **Retrieval practice** — quizzing rather than re-studying. The testing effect alone improves recall by ~50% [S6].
4. **Variation** — practising the same item across different sentence contexts and question formats.
5. **Reduced feedback** — gradually withholding hints and correct-answer reveals to build self-monitoring.

**The optimal challenge point**: the research identifies a "sweet spot" where difficulty is high enough to require genuine effort but low enough to remain achievable [S4]. In practice:

- SM-2 and FSRS spaced-repetition algorithms target ~85-90% correct at review time. Below 80% correct indicates items are too hard; above 95% indicates reviews are too frequent [S9, S10].
- A commonly cited error-rate target for vocabulary acquisition is 15-20% errors during practice sessions — not so high as to be demoralising, not so low as to produce illusion of mastery.
- The Duolingo 2022 path redesign improved learning outcomes by increasing difficulty calibration, so learners spent more time in the productive struggle zone [S2].

**Warning — difficulty stacking**: Bjork's lab found that combining multiple desirable difficulties simultaneously (e.g., interleaving + spacing + reduced feedback + harder question format all at once) can tip past the productive zone into demoralisation. Introduce each variable separately [S6].

---

### 3. Immediate vs delayed feedback

The research picture here is more nuanced than the popular assumption that "immediate is always better".

**Overall finding**: Applied studies using real learning materials and classroom-style quizzes generally find immediate feedback equal to or slightly better than delayed feedback [S7]. A 2023 systematic review of 20 studies (2006-2021) found immediate feedback was "more effective or equally effective" in text-based CMC and hybrid-feedback conditions, but no significant difference in face-to-face oral or CALL contexts [S7].

**For semi-open-ended questions** (fill-blank, short answer): A 2025 Frontiers study found that simply showing the correct response (CR feedback) outperformed both elaborated explanation (EF) and no feedback. Elaborated explanations actually _harmed_ outcomes, likely through cognitive overload. Instructors systematically overestimate the value of more explanation [S11].

**For LLM chatbot / dialogue contexts**: A 2026 study found no statistically significant difference in grammar learning between immediate corrective feedback (ICF) and delayed corrective feedback (DCF) groups, but ICF produced significantly higher perceived chatbot effectiveness (p=0.0495) and engagement [S13].

**Practical conclusions**:
- Immediate feedback wins for motivation and engagement in all contexts.
- For production drills (typing, listening-spell): show the correct answer immediately after submission, without lengthy elaboration.
- For conjugation drills: show the correct form immediately and prompt one retry — retrieval + error correction in sequence.
- For dialogue-reply: slight delay (end-of-turn) before feedback is acceptable and may encourage deeper processing.
- Avoid long explanatory panels by default; surface them only on demand ("Why was I wrong?").

---

### 4. Adaptive difficulty and item response theory

**Item Response Theory (IRT)** models the probability of a correct response as a function of both item difficulty (b) and learner ability (θ). In computerised adaptive testing (CAT), after each response the ability estimate is updated and the next item is selected to match it [S14].

**Key principles for app design**:
- **Cold-start problem**: new learners have no ability estimate. Standard approach is to start with medium-difficulty items and converge quickly (typically 5-10 items) [S14].
- **On-the-fly calibration**: items shown to many learners naturally accumulate difficulty estimates from response rates; no pre-testing required [S15].
- **Format-aware IRT**: question format itself shifts apparent difficulty independent of content. A translation-typing item on the same vocabulary is harder than an MCQ on the same word [S16]. If Lekkertaal mixes formats across a session without adjusting for format difficulty, the ability estimate will be biased.
- **ZPD alignment**: adaptive systems using Vygotsky's Zone of Proximal Development establish a learner baseline first (using brief recognition items), then serve production items just beyond current independent performance [S17].

**Practical recommendation**: Lekkertaal does not need a full IRT engine to benefit from adaptive difficulty. A simpler effective approach is:
1. Track per-item correct/incorrect streaks.
2. After 3 consecutive errors on a vocabulary item, fall back to an easier format (MCQ or word-bank) for that item.
3. After 3 consecutive correct answers, advance to a harder format (cloze, then free production).
4. Use SM-2 or FSRS for flashcard scheduling with target retrievability 85-90%.

---

### 5. Platform benchmarks: Duolingo, Babbel, Kahoot

**Duolingo** uses a mix of translation (both directions), word-bank sentence construction, listening-and-type, picture-word matching, and speaking exercises. Their 2022 "path" redesign was tested at scale; learners in the updated system showed higher reading and listening scores [S2]. Duolingo research also confirms that the combination of spaced repetition + varied exercise types produces outcomes equivalent to 5 university semesters of language study after completing their intermediate B1 content [S2]. The exercise sequencing in a lesson typically moves from recognition (tap-what-you-hear, word matching) toward production (type-the-translation) as the lesson progresses — a pattern consistent with the research on scaffolded production.

**Babbel** takes a more grammar-explicit approach, interleaving focused grammar lessons with spaced vocabulary reviews. Their model emphasises review sessions triggered by forgetting-curve timing rather than a fixed lesson path. Head-to-head comparison studies are sparse, but Babbel's design is more consistent with IRT-based adaptive scheduling.

**Kahoot** is competitive MCQ-only, designed for group synchronous settings. Its feedback is immediate (correct/incorrect + leaderboard). Research shows Kahoot use increases engagement, motivation, and collaborative vocabulary reinforcement, but its recognition-only format makes it insufficient as a standalone vocabulary acquisition tool [S18, S19].

**Key pattern across all three**: no production platform relies exclusively on any single format. The best outcomes come from mixing formats across a session, with a progression from recognition to production.

---

### 6. Lekkertaal-specific drill analysis

Lekkertaal's current drill catalogue:

| Drill type | Format class | Cognitive demand | Primary skill |
|---|---|---|---|
| multiple-choice | Recognition | Low | Receptive vocab |
| picture-choice | Recognition + dual coding | Low | Receptive vocab |
| word-bank | Scaffolded production | Medium | Syntax + vocab |
| fill-blank / cloze | Scaffolded production | Medium | Grammar + vocab |
| flashcard | Spaced recognition/recall | Variable | Receptive vocab |
| match-pairs | Recognition | Low-medium | Receptive vocab |
| listening-spell | Free production | High | Phonics + spelling |
| translation-typing | Free production | High | Full encoding |
| conjugation | Free production | High | Grammar automatisation |
| dialogue-reply | Communicative production | Highest | Pragmatics + fluency |

The catalogue spans the full difficulty spectrum, which is a strength. The question is sequencing and weighting.

---

## Recommendations for Lekkertaal

### R1 — Sequence within each lesson arc: recognition first, production last

Begin each lesson block with 1-2 recognition items (picture-choice, multiple-choice, or match-pairs) to activate prior knowledge and establish context. Then progress through word-bank and fill-blank into translation-typing or listening-spell. End boss-fight scenarios with dialogue-reply as the pushed-output capstone. This scaffolded progression matches Duolingo's observed session design and is consistent with ZPD theory.

### R2 — Weight free-production drills more heavily in review sessions

For new vocabulary introduction, recognition formats are fine. For spaced review sessions (the flashcard tail), prefer listening-spell or translation-typing over multiple-choice: the harder format at review time produces stronger re-encoding. The flashcard component should trigger the harder format for items the learner already got right once.

### R3 — Schedule flashcard reviews with SM-2 or FSRS, not fixed intervals

Target 85-90% correct at review time. The current default interval (if any) should be replaced with an algorithm that extends intervals after correct answers and shortens them after errors. FSRS is the modern successor to SM-2 and handles irregular review patterns better. Both are well-understood and have open implementations.

### R4 — Immediate feedback, correct-answer first, elaboration on demand

After any production drill (translation-typing, listening-spell, fill-blank, conjugation), show the correct answer immediately on error. Do not auto-play a lengthy explanation. Add a "Why?" or "Show tip" disclosure that the learner can tap if curious. This matches the Frontiers 2025 finding that correct-response feedback outperforms elaborated feedback for semi-open-ended questions [S11].

### R5 — Keep per-session error rate between 15-25%

If a learner is getting more than 25% wrong in a session, the content is too hard — fall back to recognition formats or reduce the vocabulary batch size. If they are getting less than 10% wrong, the session is too easy — advance to harder formats or increase the vocabulary batch. This can be approximated without IRT using a simple rolling correctness window.

### R6 — Interleave vocabulary sets within a session, not at topic boundaries

Avoid presenting all "food vocabulary" items together and then all "transport vocabulary" items together. Interleaving the two sets forces the learner to discriminate between them, a desirable difficulty that increases transfer [S4, S6]. This is especially applicable to word-bank and multiple-choice drills where distractors can be drawn from adjacent vocabulary sets.

### R7 — Use listening-spell early and often

Listening-spell is Lekkertaal's highest-value single drill type per cognitive effort: it forces phonological decoding, spelling, and vocabulary recall simultaneously, with auditory input reinforcing the orthographic form. Research on dictation tasks confirms their multimodal retention advantage [S12]. Current usage should be increased, particularly for vowel-heavy Dutch words where pronunciation diverges from spelling.

### R8 — Reserve dialogue-reply for end of lesson arc (boss fight is correct)

The existing boss-fight structure (dialogue-reply as the capstone) is pedagogically sound. Task-based language teaching research shows dialogue and roleplay produce greater speaking competence and motivation gains than isolated drills [S20], and they work best after learners have automatised the target forms through prior drills. Do not move dialogue-reply earlier in the sequence.

### R9 — Add per-item format fallback for struggling items

If a learner gets the same vocabulary item wrong 3 or more times in production format, temporarily surface it as a multiple-choice item to break the failure loop and rebuild confidence, then re-introduce it in production format at the next session. This is the ZPD scaffolding principle applied mechanically and is achievable without IRT.

### R10 — Conjugation drills: enforce accuracy, not speed (yet)

Conjugation drills should require 100% correct answers (with retry) before advancing. Speed-based pressure is a secondary concern until forms are accurate; introducing time pressure before accuracy is established creates anxiety without learning gain. Once a conjugation pattern is mastered in the drill, it should appear naturally inside translation-typing and dialogue-reply sentences — this is the "contextualised practice" step that moves form knowledge into communicative use [S21].

---

## Sources

| ID | Citation | URL | Relevance |
|---|---|---|---|
| S1 | PMC (2024) — "The battle of question formats: VSAQs vs MCQs" | https://pmc.ncbi.nlm.nih.gov/articles/PMC11684041/ | MCQ vs VSAQ retention study — no significant difference on delayed test |
| S2 | Duolingo Research Blog — "4 Learnings from Duolingo Efficacy Studies" | https://blog.duolingo.com/results-duolingo-efficacy-studies/ | Duolingo path design outcomes; exercise mix evidence |
| S3 | PMC (2017) — "The effect of recall, reproduction, and restudy on word learning" | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5545031/ | Cued recall vs other practice types for vocabulary |
| S4 | Structural Learning — "Desirable Difficulties: Bjork's 5 Principles" | https://www.structural-learning.com/post/desirable-difficulties | Bjork's 5 principles, spacing, interleaving, retrieval |
| S5 | PubMed / Bjork Lab — "Desirable Difficulties in Vocabulary Learning" | https://pubmed.ncbi.nlm.nih.gov/26255443/ | Generation effect, semantic mixing, prediction before study |
| S6 | 3-Star Learning Experiences — "Demystifying desirable difficulties" | https://3starlearningexperiences.wordpress.com/2023/02/21/demystifying-desirable-difficulties-1-what-they-are/ | Desirable vs undesirable difficulties; performance-learning distinction |
| S7 | Frontiers in Psychology (2023) — "Optimal timing of corrective feedback in L2 learning: systematic review" | https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1026174/full | 20-study systematic review on immediate vs delayed feedback timing |
| S8 | Frontiers in Psychology (2022) — "Dual Coding or Cognitive Load? Multimodal input on EFL vocabulary" | https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.834706/full | Dual coding theory for picture-word drills |
| S9 | Migaku — "Spaced Repetition in 2026: What Actually Works" | https://migaku.com/blog/language-fun/spaced-repetition-in-2026-what-actually-works-for-language-learners | SM-2 vs FSRS; 85-90% target retention; 200-400% improvement claim |
| S10 | SM-2 / FSRS comparison — Mindomax | https://www.mindomax.com/fsrs-vs-sm2-spaced-repetition-algorithm | Algorithm specifics: ease factor, interval calculation |
| S11 | Frontiers in Education (2025) — "Simpler immediate feedback improves language learning in semi-open-ended questions" | https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1654809/full | Correct-response feedback beats elaborated explanation |
| S12 | SAGE (2025) — "Learning multiword items through dictation and dictogloss" | https://journals.sagepub.com/doi/10.1177/13621688221117242 | Dictation as multimodal retention tool |
| S13 | Frontiers in Education (2026) — "Immediate vs delayed corrective feedback in LLM chatbot language learning" | https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1703664/full | ICF vs DCF in chatbot setting; engagement advantage of ICF |
| S14 | ScienceDirect — "Integrating ML into IRT for adaptive learning cold-start problem" | https://www.sciencedirect.com/science/article/abs/pii/S036013151930096X | IRT cold-start; item calibration in online systems |
| S15 | Springer — "On-the-fly parameter estimation based on IRT in adaptive learning systems" | https://link.springer.com/article/10.3758/s13428-022-01953-x | Real-time IRT calibration without pre-testing |
| S16 | EDM 2022 — "Format-Aware IRT for Predicting Vocabulary Proficiency" | https://educationaldatamining.org/edm2022/proceedings/2022.EDM-posters.84/ | Question format as IRT difficulty modifier |
| S17 | Raccoon Gang — "Zone of Proximal Development and adaptive tech" | https://raccoongang.com/blog/zone-of-proximal-development/ | ZPD theory applied to adaptive learning app design |
| S18 | Frontiers in Education (2024) — "Impact of game-based tool on engagement in foreign language course" | https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2024.1430729/full | Kahoot engagement and motivation outcomes |
| S19 | Academy Publication — "Kahoot as a formative assessment tool in foreign language" | https://www.academypublication.com/issues2/tpls/vol10/11/01.pdf | Kahoot mechanics and immediate feedback design |
| S20 | ERIC (2022) — "Effects of task-based language teaching and audio-lingual method" | https://files.eric.ed.gov/fulltext/EJ1330429.pdf | Task-based vs drill-only approaches; roleplay effectiveness |
| S21 | Language Gym / Conti (2016) — "How verb conjugation drills enhance fluency" | https://gianfrancoconti.com/2016/01/07/how-verb-conjugation-drills-can-enhance-oral-and-written-fluency/ | Drill automatisation + contextualised practice model |

---

## Child documents

None at this time. If the IRT / adaptive difficulty section is built out in implementation, create `docs/research/quiz-assessment-design/adaptive-difficulty.md`.
