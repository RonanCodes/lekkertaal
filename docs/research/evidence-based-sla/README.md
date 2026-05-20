---
title: "Evidence-based SLA principles"
issue: https://github.com/RonanCodes/lekkertaal/issues/183
wiki: llm-wiki-learn-dutch/evidence-based-sla
status: draft
last_updated: 2026-05-20
---

# Evidence-based SLA principles

A synthesis of second-language acquisition (SLA) theory and cognitive-science research, distilled into actionable design principles for Lekkertaal's lesson engine.

## Summary

Six decades of SLA research and two decades of cognitive-science work on memory converge on the same conclusion: acquisition is not passive absorption. It requires adequate input, active production, timely feedback, and retrieval practice distributed across time. No single technique is sufficient. The strongest learning outcomes come from combining high-quality comprehensible input, pushed output, corrective feedback, spaced retrieval, interleaving, and an experience design that sustains daily motivation over months.

The document covers:

1. Krashen's input hypothesis and its current standing (including recent neuroscience critique)
2. Swain's output hypothesis and Long's interaction hypothesis
3. The cognitive-science triad: retrieval practice, spacing, and interleaving
4. The grammar-instruction debate: explicit vs implicit approaches
5. Motivation and habit formation (BJ Fogg's behaviour model, self-determination theory)
6. Recommendations and the 5-7 principles Lekkertaal should build around

---

## Findings

### 1. Krashen's Input Hypothesis (i+1) — current standing

**Theory.** Stephen Krashen proposed in 1982 that acquisition occurs when learners receive _comprehensible input_ at level i+1 — just above their current competence. Conscious grammar study ("learning") is held separate from unconscious "acquisition". The hypothesis drove the shift toward communicative language teaching in the 1980s and remains one of the most cited frameworks in SLA.

**Evidence in favour.** Comprehensible input is a genuine prerequisite. Without meaningful exposure to the target language, no acquisition occurs. Frequency effects on incidental vocabulary learning are real: a 2019 meta-analysis (Uchihara et al., 26 studies, N = 1,918) found r = .34 for repetition on incidental vocabulary acquisition. [14]

**Key critiques.** The theory has accumulated serious challenges since Gregg (1984) and McLaughlin (1978):

- _Vagueness_: "i+1" has no operational definition and cannot be tested precisely. Learners have "spiky profiles" across skills, making a single level label impossible. [1]
- _Passive-reception assumption_: Neuroscience research (Li & Jeong, 2020) shows that interactive learning produces superior behavioural outcomes and increased functional connectivity in brain language networks relative to passive video watching. Speech production recruits distinct right-hemisphere networks not active during comprehension alone (Indefrey & Levelt, 2004; Price, 2012). [1]
- _Form-focused instruction omitted_: Meta-analyses (Norris & Ortega, 2000; 49 studies) demonstrate that explicit instruction on linguistic form produces large target-oriented gains — well above what input alone achieves. [8]
- _Ecological critique_: Van Lier (2004) reframes language development as active exploitation of affordances rather than graded passive input. Context, gesture, and multimodal cues make input comprehensible independent of simplification. [1]
- _Adaptive algorithms outperform static i+1_: Duolingo analyses (Portnoff et al., 2021; Jiang et al., 2024) show that machine-learning personalization beats static word-list approaches. [1]

**Net assessment.** Comprehensible input is _necessary_ but not _sufficient_. Modern SLA treats it as one ingredient, not the whole recipe. The neuro-ecological framework (Frontiers in Psychology, 2025, DOI: 10.3389/fpsyg.2025.1636777) argues for personalized, multimodal, interaction-rich environments instead. [1]

---

### 2. Swain's Output Hypothesis and Long's Interaction Hypothesis

**Swain (1985, 1995, 2005).** Merrill Swain observed that French immersion students in Canada achieved near-native _comprehension_ after years of rich input but maintained non-native _production_. She proposed that producing output serves three functions beyond mere practice:

1. _Noticing_: Attempting to speak or write forces learners to notice gaps between intended meaning and current ability (Swain, 1997).
2. _Hypothesis testing_: Output is a tool for trying out forms and receiving feedback on whether they communicate the intended meaning.
3. _Metalinguistic reflection_: Production demands syntactic processing, not just semantic shortcuts available during comprehension. [3, 5]

Empirical support: experiments comparing pushed output to input-only conditions consistently favour output plus input. A study by Russell (2014, Foreign Language Annals) found output with enhanced input produced greater gains than input alone for Spanish future tense. [9] Yuan and Ellis (2003) showed that planning time before output tasks improves both fluency and syntactic complexity. [10]

**Long's Interaction Hypothesis (1981, revised 1996).** Michael Long argues that _interaction_ compounds the benefits of both input and output. When communication breaks down, negotiation-of-meaning episodes supply:
- Corrective feedback (negative evidence)
- Modified input calibrated in real time
- Directed attention to specific linguistic forms [6]

Long (1996) links negotiation of meaning to Schmidt's noticing hypothesis: breakdowns _force_ attention to form in a way that passive input does not. Mackey and Goo (2007) meta-analysis confirmed grammar gains from interaction. [10]

**Practical consequence for apps.** AI roleplay, corrective feedback on user-typed or spoken responses, and tasks that require producing precise Dutch (rather than just recognising it) are not bells-and-whistles — they are the primary mechanism through which production competence develops. Lekkertaal's existing boss-fight roleplay and translation-typing drills are directly justified by this body of evidence.

---

### 3. Retrieval Practice (Testing Effect)

**Core finding.** Testing is not just assessment — it is a powerful learning event. Roediger and Karpicke (2006, Psychological Science) showed that students who took retrieval tests recalled substantially more material on a delayed test one week later than students who restudied the same material (testing advantage at 1 week; advantage reversed only at 5-minute retest). Crucially, students who restudied expressed _higher_ confidence in their learning — an "illusion of fluency" not matched by actual retention. [2]

**Vocabulary specifics.** Karpicke and Roediger (2008, Science) used foreign language word pairs (Swahili-English). Once a word was correctly recalled, continued _studying_ had no effect on delayed recall. Continued _testing_ after initial mastery produced a large positive effect (Science, 319, 966-968). [2]

**Effect size.** A meta-analysis of 29 studies cited by Bjork's lab (Bjork & Bjork, 2011) reports a mean effect size of g = 0.74 for retrieval practice relative to restudying. [4]

**Decade-of-progress review.** The ERIC review of retrieval-based learning (Karpicke, 2017) confirms: retrieval benefits generalise across educational levels, age groups, subject matter domains, and transfer to novel contexts beyond the immediate test. [2]

**For Lekkertaal.** Every drill that forces production (fill-in-blank, translation-typing, conjugation, word bank selection) is a retrieval event. The lesson engine should _not_ default to "show the answer then ask again" loops — those preserve the illusion of mastery without the retention benefit. Prompting recall before revealing is non-negotiable.

---

### 4. Spacing Effect

**Cepeda et al. (2006, Psychological Bulletin).** The definitive meta-analysis of distributed practice reviewed 317 experiments (184 articles, 839 assessments). Main finding: the optimal inter-study interval (ISI) is not fixed — it scales _jointly_ with the desired retention interval. A shorter gap is optimal when you need to recall something soon; a much longer gap is optimal when you need the material weeks or months later. [Source 6 on yorku.ca]

**Vocabulary meta-analysis (Kim, 2022, Language Learning).** 98 effect sizes from 48 experiments (N = 3,411) specifically in SLA. Spaced practice showed a medium-to-large effect on second language learning. Critically: shorter spacing was as effective as longer spacing on _immediate_ post-tests but significantly _less_ effective on delayed post-tests. This replicates the Cepeda finding in a language-specific context. [13]

**Practical algorithm.** The SuperMemo/SM-2 algorithm (used by Anki) operationalises this: initial intervals of 1 day, then expanding by a factor of ~2.5. Research shows 90%+ retention rates are achievable with 5-minute daily sessions using this approach. [12]

**Seibert Hanson and Brown (2020).** Mobile-assisted spaced repetition for L2 vocabulary produced measurable gains but exposed a key tension: "effective but bitter pill" — learners recognised the effectiveness while reporting declining engagement with purely mechanical repetition. This motivates integrating SRS within varied, game-like contexts rather than offering standalone flashcard sessions. [11]

**For Lekkertaal.** Vocabulary and grammar forms should be scheduled via a spaced repetition algorithm, not presented in linear chapter order. Items with zero-retention-risk should be deprioritised; items approaching the forgetting threshold should surface regardless of which lesson pack the user is in.

---

### 5. Interleaving

**Rohrer (2014, Psychonomic Bulletin).** A randomised trial with Grade 7 students (n = 140) over 9 weeks found that interleaved practice produced a test score of 72% vs 38% for blocked practice — effect size d = 1.05. Critically, the benefit held even when different problem types were superficially dissimilar, extending beyond the "discrimination" explanation. [Source PubMed 24578089]

**Mechanism (Bjork, 2011).** Interleaving creates "desirable difficulties": the effort required to switch between problem types at encoding produces encoding and retrieval processes that strengthen storage and retrieval pathways. The short-term performance cost (harder during practice) predicts long-term retention gains. Bjork identifies four core desirable difficulties: varying conditions, interleaving topics, spacing sessions, and using retrieval rather than re-exposure. [4]

**L2 vocabulary (Libersky et al., 2025, Language Learning).** Interleaved conditions produced faster response speeds than blocked conditions for L2 vocabulary items studied in mixed (interleaved) sequences. [Sagepub DOI 10.1177/02676583251338768]

**L2 grammar (ScienceDirect, 2024).** Interleaved practice improved grammar acquisition for similar and dissimilar tenses in Romance languages relative to blocked practice. [ScienceDirect S0959475224001725]

**Nakata and Suzuki (2019, Modern Language Journal).** Compared blocking, interleaving, and increasing-spacing conditions on L2 vocabulary. Interleaved conditions showed faster response times, supporting interleaving as a genuine advantage not just an artefact of spacing. [via yuichisuzuki.net]

**For Lekkertaal.** Drill sessions should not block all vocabulary drills together, then all conjugation drills, then all listening drills. Instead, drill types should be interleaved within a session. Existing drill variety (word-bank, picture-choice, translation-typing, listening-spell, dialogue-reply) is an asset — the scheduling layer should exploit this variety intentionally.

---

### 6. Grammar Instruction: Explicit vs Implicit

**Norris and Ortega (2000), Language Learning.** The landmark meta-analysis reviewed 49 experimental studies published 1980-1998. Finding: focused instruction produces large gains; _explicit_ instruction (rule explanation, metalinguistic feedback) outperforms implicit instruction; Focus-on-Form (grammar embedded in communicative tasks) and Focus-on-Forms (discrete grammar items) produce equivalent large effects. [8]

**The weak interface (Ellis, 2004; Nick Ellis, 2010).** Explicit knowledge cannot directly become implicit procedural knowledge, but it can direct _attention_ to forms in input, jump-starting the implicit learning system. This "weak interface" position is now the consensus in SLA: explicit instruction matters, not because it becomes fluency directly, but because it shapes noticing. [per Frontiers 2025 review]

**Schmidt's Noticing Hypothesis (1990, Applied Linguistics).** Learners must consciously _notice_ a linguistic feature in input for that feature to become intake contributing to acquisition. Noticing is the necessary bridge between input and acquisition. Form-focused instruction works precisely because it raises the probability of noticing. [7]

**Balance recommendation.** Pure communicative input ("just talk and you'll acquire it") is empirically too slow for adults with a specific target date for competence. Pure grammar drilling produces accuracy knowledge that does not automatise into fluent production. The evidence-backed balance is: communicative contexts that supply rich input plus pushed output, with form-focused feedback triggered by learner errors or pre-planned targets (Focus-on-Form), supplemented by brief explicit rule explanation where attested gaps exist. [8, 10]

**For Lekkertaal.** Drill feedback should not just mark correct/incorrect — it should, when an error touches a known grammar pattern, surface a brief rule explanation or contrast. The boss-fight roleplay sessions provide communicative context; grammar-specific drills (conjugation, word-bank sentence assembly) provide form focus. Both are needed.

---

### 7. Motivation and Habit Formation

**BJ Fogg's Behaviour Model (2007, formalised in Tiny Habits, 2020).** Behaviour occurs when Motivation, Ability, and a Prompt converge simultaneously (B = MAP). Motivation is unreliable (Fogg calls it "the party-animal friend"). The reliable levers for daily practice are: reducing friction (ability), designing effective prompts (push notifications, entry cues), and anchoring habits to existing routines. Tiny habits — starting absurdly small — exploit low-motivation moments rather than waiting for high motivation. [Source bjfogg.com]

**Self-Determination Theory (Deci and Ryan, 1985; Ryan and Deci, 2000, American Psychologist).** Intrinsic motivation — the kind that sustains months-long practice — requires satisfaction of three basic needs:
1. _Autonomy_: the learner controls their own actions and choices.
2. _Competence_: the learner experiences mastery and genuine progress.
3. _Relatedness_: meaningful connection to others or to a purpose. [Source ScienceDirect SDT overview]

When these are satisfied, extrinsic rewards (points, streaks) can complement rather than displace intrinsic motivation. When external rewards become the only driver, intrinsic interest erodes — the "overjustification effect".

**Gamification evidence.** A Frontiers in Psychology (2024) study using structural equation modelling (n = 413 Chinese language learners) found: gamification directly explained learning outcomes (β = 0.440, f² = 0.234, moderate effect); 45.8% of gamification's effect operated _through_ motivation. Learning style alignment significantly moderated the relationship. The systematic review of 40 EFL/ESL gamification studies (Frontiers, 2022) confirmed widespread benefits but identified: novelty effects wearing off, competitive elements raising anxiety in some learners, and over-reliance on extrinsic rewards crowding out intrinsic interest. [Sources Frontiers 2024, Frontiers 2022]

**Mobile app engagement.** Duolingo research (Jiang et al., 2021, Foreign Language Annals) found that beginning-level learners using the app made measurable gains in reading and listening. The platform's daily streaks and XP mechanics are consistent with Fogg's Prompt layer — reducing the barrier to entry. However, Seibert Hanson and Brown (2020) warn that pure repetition mechanics (even effective ones) produce declining engagement without varied, meaningful practice. [11]

**For Lekkertaal.** The streak, coins, and freezes system is evidence-backed for sustaining daily practice. The risk is shallow externalisation: users chasing streaks rather than mastering Dutch. The antidote is progressive difficulty (protecting competence), learner choice in drill type or topic (autonomy), and social comparison carefully scoped (leaderboard as motivation, not shame spiral). Daily notifications should be personalised to the user's revision debt (which items are approaching forgetting threshold) rather than generic reminders.

---

## Recommendations for Lekkertaal

### The 5-7 evidence-based principles Lekkertaal's lesson engine should be built around

**1. Retrieval before re-exposure (Testing Effect)**
Every drill interaction must prompt recall _before_ revealing the answer. Remove any "show first, test later" flows. The engine's core loop is: prompt → attempted recall → feedback → (schedule next retrieval based on performance). Sources: Roediger & Karpicke (2006); Karpicke & Roediger (2008).

**2. Spaced scheduling tied to forgetting curve (Spacing Effect)**
Items should be scheduled based on an SRS algorithm (SM-2 or equivalent). The review interval expands from ~1 day after first successful recall to weeks or months for well-consolidated items. Linear chapter progression must be replaced by (or layered beneath) an SRS queue. Newly introduced items surface frequently; mastered items surface rarely. Sources: Cepeda et al. (2006); Kim (2022, Language Learning).

**3. Interleaved drill types within every session (Interleaving)**
A session of pure vocab drills, then pure conjugation, then pure listening is suboptimal. Sessions should mix drill types (word-bank, picture-choice, translation-typing, conjugation, listening-spell, dialogue-reply) so the learner cannot rely on context-specific pattern matching. The existing drill variety is the asset; the scheduler just needs to exploit it. Sources: Rohrer (2014); Bjork & Bjork (2011); Libersky et al. (2025).

**4. Pushed output with corrective feedback (Output + Interaction Hypotheses)**
Recognition drills (tap the correct picture, select from a word-bank) should be complemented by production drills (type the translation, speak the sentence, complete the roleplay turn). Feedback must close the loop explicitly: marking an error should, when a known grammar pattern is at play, surface a brief rule cue. The boss-fight AI roleplay is the highest-value feature for production competence at scale. Sources: Swain (1985, 1995); Long (1996); Norris & Ortega (2000).

**5. Comprehensible input + form attention (Input + Noticing)**
Lesson content must remain comprehensible to the learner's current level, but that does not mean avoiding challenge. New vocabulary and grammar should appear embedded in sentences and dialogue contexts (not bare word-translation pairs where possible). Form-focused cues — subtle visual highlighting, immediate error correction — help learners notice target forms without halting the communicative flow. Sources: Krashen (1982); Schmidt (1990); Van Lier (2004); Frontiers 2025 critique.

**6. Autonomy + competence loop for sustained motivation (SDT + Fogg)**
The gamification layer must protect intrinsic motivation:
- Autonomy: offer meaningful choice (which topic, which drill type, which AI scenario).
- Competence: calibrate difficulty so learners succeed ~70-80% of the time before a drill retires. Streaks and coins reinforce the _habit_, not the _competence signal_ — do not let a user maintain a streak by trivially replaying mastered material.
- Fogg: reduce daily friction to the minimum (pre-selected due-items ready, one tap to start); personalise push notifications to revision debt rather than generic "practice Dutch today".
Sources: Deci & Ryan (2000); Fogg (2007, 2020); Frontiers 2024 gamification study; Frontiers 2022 systematic review.

**7. Mixed explicit/implicit balance (Grammar Instruction)**
Brief, precisely timed explicit grammar cues (30-60 second rule cards surfaced on error patterns, not front-loaded) outperform either pure communicative immersion or pure grammar drilling. Implement as: error-triggered grammar cards, optional "why" explanations on any feedback screen, and vocabulary entries that show the word in a full sentence (contextual grammar exposure). Sources: Norris & Ortega (2000); Schmidt (1990); Ellis (2004).

---

### Secondary recommendations (implementation detail)

- **Algorithm**: Start with SM-2 for simplicity; it can be replaced with a learned forgetting-curve model (FSRS is the current state-of-the-art open implementation) once usage data accumulates.
- **Drill difficulty**: Target 70-80% correct-at-first-attempt per session. If a user is above 90%, surface harder or less-reviewed items. Below 60%, surface easier items to restore competence feeling.
- **Roleplay sessions**: Cap to 5-10 minute sessions per BJ Fogg's ability axis — short enough to start on low motivation days, long enough to be meaningful.
- **Notifications**: Personal (what items are due today), not generic. A/B test the content of push copy; evidence shows relevance >> frequency for sustained open rates.
- **Leaderboard**: weekly scope, friend group scope, opt-in only — reduces anxiety-driven avoidance for learners behind the curve.

---

## Sources

1. **Frontiers in Psychology (2025)** — "Beyond comprehensible input: a neuro-ecological critique of Krashen's hypothesis in language education." DOI: 10.3389/fpsyg.2025.1636777. PMC: PMC12577063. Primary neuro-ecological critique of Krashen, with Li & Jeong 2020 neural evidence. URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC12577063/

2. **Roediger, H.L. & Karpicke, J.D. (2006)** — "Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention." Psychological Science, 17(3), 249-255. The canonical testing-effect paper with 5-minute / 2-day / 1-week retention design. URL: https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2006.01693.x

3. **Karpicke, J.D. & Roediger, H.L. (2008)** — "The Critical Importance of Retrieval for Learning." Science, 319(5865), 966-968. Foreign vocabulary word pairs: testing after mastery outperforms restudying; students cannot predict their own performance. URL: https://www.science.org/doi/abs/10.1126/science.1152408

4. **Bjork, E.L. & Bjork, R.A. (2011)** — "Making Things Hard on Yourself, But in a Good Way: Creating Desirable Difficulties to Enhance Learning." In M.A. Gernsbacher et al. (Eds.), Psychology and the Real World. Canonical desirable-difficulties framework. g = 0.74 meta-analytic effect size for retrieval practice. URL: https://bjorklab.psych.ucla.edu/research/

5. **Swain, M. (1985, 1995, 2005)** — Output Hypothesis. Three functions: noticing, hypothesis testing, metalinguistic reflection. Primary evidence from Canadian French immersion data. Reviewed via: https://vietnamteachingjobs.com/blog/what-is-swains-output-hypothesis-and-why-does-it-matter-for-language-learning/

6. **Long, M.H. (1981, 1996)** — Interaction Hypothesis. "Input, Interaction, and Second-Language Acquisition." Revised 1996 version emphasises negotiation of meaning and corrective feedback. Wikipedia entry with full reference chain: https://en.wikipedia.org/wiki/Interaction_hypothesis

7. **Schmidt, R. (1990, 2010)** — Noticing Hypothesis. "The Role of Consciousness in Second Language Learning." Applied Linguistics. Noticing is the necessary condition for input becoming intake. URL: https://nflrc.hawaii.edu/PDFs/SCHMIDT%20Attention,%20awareness,%20and%20individual%20differences.pdf

8. **Norris, J.M. & Ortega, L. (2000)** — "Effectiveness of L2 Instruction: A Research Synthesis and Quantitative Meta-Analysis." Language Learning, 50(3), 417-528. 49 studies; explicit instruction outperforms implicit; large effect sizes for focused instruction. URL: https://onlinelibrary.wiley.com/doi/abs/10.1111/0023-8333.00136

9. **Cepeda, N.J., Pashler, H., Vul, E., Wixted, J.T., & Rohrer, D. (2006)** — "Distributed Practice in Verbal Recall Tasks: A Review and Quantitative Synthesis." Psychological Bulletin, 132(3), 354-380. 317 experiments, 839 assessments; optimal ISI scales with retention interval. URL: https://www.yorku.ca/ncepeda/publications/CPVWR2006.html

10. **Conti, G.F. (2025)** — "The Science of Modern Language Teaching: The Top 10 Research-Backed Instructional Techniques." The Language Gym blog. Synthesises Swain, Long, Yuan & Ellis, Lyster & Ranta, Mackey & Goo. URL: https://gianfrancoconti.com/2025/03/27/the-science-of-modern-language-teaching-success-the-top-10-research-backed-instructional-techniques/

11. **Seibert Hanson, A. & Brown, C. (2020)** — "Enhancing L2 Learning Through a Mobile-Assisted Spaced Repetition Tool." ReCALL / Andymatuschak mirror. "Effective but bitter pill" conclusion: gains confirmed but learner satisfaction challenged by mechanical repetition. URL: https://andymatuschak.org/files/papers/Seibert%20Hanson%20and%20Brown%20-%202020%20-%20Enhancing%20L2%20learning%20through%20a%20mobile%20assisted%20sp.pdf

12. **Duolingo Blog (2023)** — "Why is Spaced Repetition So Important for Learning?" Practitioner overview of SRS algorithms used in the platform, with references to Ebbinghaus and SM-2. URL: https://blog.duolingo.com/spaced-repetition-for-learning/

13. **Kim, Y. (2022)** — "The Effects of Spaced Practice on Second Language Learning: A Meta-Analysis." Language Learning. 98 effect sizes, 48 experiments (N = 3,411). Medium-to-large effect; longer spacing advantages emerge on delayed (not immediate) tests. URL: https://onlinelibrary.wiley.com/doi/abs/10.1111/lang.12479

14. **Uchihara, T., Webb, S., & Yanagisawa, A. (2019)** — "The Effects of Repetition on Incidental Vocabulary Learning: A Meta-Analysis of Correlational Studies." Language Learning, 69(3). 26 studies, N = 1,918; r = .34 for repetition on incidental vocabulary. URL: https://onlinelibrary.wiley.com/doi/abs/10.1111/lang.12343

15. **Ryan, R.M. & Deci, E.L. (2000)** — "Self-Determination Theory and the Facilitation of Intrinsic Motivation, Social Development, and Well-Being." American Psychologist, 55(1), 68-78. The three basic needs: autonomy, competence, relatedness. URL: https://www.researchgate.net/publication/11946306_Self-Determination_Theory_and_the_Facilitation_of_Intrinsic_Motivation_Social_Development_and_Well-Being

16. **Fogg, B.J. (2007, 2020)** — Fogg Behaviour Model (B = MAP) and _Tiny Habits_. Motivation is unreliable; design for ability and prompts. URL: https://www.bjfogg.com/learn

17. **Frontiers in Psychology (2024)** — "Investigating the influence of gamification on motivation and learning outcomes in online language learning." N = 413; direct β = 0.440 (f² = 0.234); 45.8% mediation through motivation. URL: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1295709/full

18. **Frontiers in Psychology (2022)** — "Gamification in EFL/ESL Instruction: A Systematic Review of Empirical Research." 40 peer-reviewed articles. Feedback, points, quizzes most frequently studied; novelty effects, competitive anxiety identified as risks. URL: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.1030790/full

19. **Rohrer, D. et al. (2014, 2015)** — "The benefit of interleaved mathematics practice." Psychonomic Bulletin & Review. Grade 7, n = 140; interleaving 72% vs blocking 38%; d = 1.05. URL: https://link.springer.com/article/10.3758/s13423-014-0588-3
