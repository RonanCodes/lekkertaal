---
title: "Structured-course methods"
issue: https://github.com/RonanCodes/lekkertaal/issues/182
wiki: llm-wiki-learn-dutch/structured-course-methods
status: draft
last_updated: 2026-05-20
---

# Structured-course methods

Research into how the major structured language-learning methods (CEFR, Assimil, Pimsleur, Michel Thomas, Teach Yourself, Glossika) are built and what Lekkertaal should borrow for its Dutch A1-to-B1 path.

## Summary

The six methods reviewed here represent distinct philosophies: CEFR provides the measurement framework; Assimil and Pimsleur privilege audio immersion plus spaced exposure; Michel Thomas removes friction and builds grammar through guided construction; Teach Yourself balances text, audio, and grammar in a thematic syllabus; Glossika drills fluency through mass sentence repetition. Underpinning almost all of them is the same cognitive science: **spaced repetition and distributed practice consistently beat massed learning** for long-term vocabulary and grammar retention (Kim 2022 meta-analysis, 48 experiments, N = 3,411).

No single method is best for every dimension. The research points toward a hybrid: CEFR-aligned can-do goals as the skeleton, thematic vocabulary clustering (Teach Yourself / Assimil), grammar scaffolded through context rather than rules lists (Michel Thomas / Pimsleur), and an SRS engine driving review timing (Glossika / Pimsleur). Audio-text integration beats either alone. Interleaved drill types beat blocked ones for long-term grammar retention.

---

## Findings

### 1. CEFR levels: what they actually require

The Common European Framework of Reference (CEFR), published by the Council of Europe and revised in the 2020 Companion Volume, defines six levels of communicative competence. Levels are described through "can-do" descriptors focused on what learners can accomplish, not on which grammar rules they have memorised.

| Level | Label | Key competencies |
|---|---|---|
| A1 | Beginner | Introduce oneself; understand and use very familiar everyday expressions; interact when the other person speaks slowly and clearly |
| A2 | Elementary | Understand frequently used expressions on personal/family topics; handle routine transactions; describe immediate circumstances in simple terms |
| B1 | Intermediate | Follow main points of standard input on familiar topics; manage most travel situations; produce simple connected text; describe experiences and explain opinions |
| B2 | Upper-Intermediate | Understand complex text including technical topics in own field; interact fluently with native speakers without strain |
| C1 | Advanced | Understand a wide range of demanding longer texts; express ideas fluently and flexibly for social, academic, and professional purposes |
| C2 | Mastery | Understand virtually everything heard or read; summarise and present information spontaneously and precisely |

**Learning hours to reach each level** (for European learners; Dutch sits close to German figures):

| Level | Hours (approx.) |
|---|---|
| A1 | 60–150 hours |
| A2 | 150–260 hours |
| B1 | 260–490 hours |
| B2 | 450–600 hours |

**How apps should map to CEFR.** The 2020 Companion Volume introduced mediating and plurilingual descriptors, but the core A1-B1 descriptors remain the practical target. Duolingo's CEFR-aligned courses use checkpoint quizzes at section boundaries to verify progress (Wikipedia/Duolingo). CEFR does not prescribe syllabus content; it describes communicative outcomes. A well-designed course reverse-engineers those outcomes into a topic/grammar sequence.

**Dutch-specific vocabulary targets:**

| Level | Active vocabulary |
|---|---|
| A1 | ~800-1,000 words |
| A2 | ~2,000 words |
| B1 | ~5,000 words |

The 2,500 most-used Dutch words account for 92% of all spoken Dutch and 82% of written Dutch (MostUsedWords Dutch Frequency Dictionary). This strongly argues for frequency-first vocabulary selection at A1-A2.

**Dutch A1 grammar inventory** (per established Dutch courses): present-tense conjugation, basic word order (SVO + inversion after fronted adverbial), the/a articles (de/het), personal and possessive pronouns, modal verbs (kunnen, moeten, willen, mogen), plural formation, question words, simple past. B1 adds: perfect tense, subordinate clauses (omdat, dat, als), comparison, separable verbs, relative clauses.

---

### 2. Method mechanics comparison

#### 2a. Assimil

**Core mechanic:** Intuitive assimilation, replicating how children absorb a first language through natural exposure before formal production is demanded.

**Structure:**
- 100 lessons, each 30-40 minutes
- Two phases running simultaneously once the active wave begins (around lesson 50):
  - Passive wave (lessons 1-49): read dialogue, listen to audio, repeat, do light exercises. No translation back into the target language. Goal is impregnation.
  - Active wave (lesson 50+): while continuing new lessons forward, the learner goes back 50 lessons and translates the dialogue *from* their native language *into* Dutch. Production is introduced only after sufficient passive exposure.
- Every 7 lessons includes a revision lesson

**Session length:** 20-40 minutes daily

**Expected outcome:** B2 in 4-5 months of consistent daily study (Assimil's own claim, which reviewers find optimistic but directionally correct)

**Strengths:** Low anxiety, natural rhythm, audio-centred, cultural content woven in. The delay before demanding output matches comprehensible input research.

**Weaknesses:** The 50-lesson passive window is somewhat arbitrary. Grammar explanations are thin footnotes. Translation as the activation mechanism is a dated choice; production drills or sentence reconstruction would serve better.

#### 2b. Pimsleur

**Core mechanic:** Graduated Interval Recall (GIR), a spaced repetition schedule applied to audio-only listening and speaking.

**GIR intervals (original Pimsleur 1967 schedule):** 5 seconds → 25 seconds → 2 minutes → 10 minutes → 1 hour → 5 hours → 1 day → 5 days → 25 days → 4 months → 2 years.

**Structure:**
- 30-minute audio lessons; no text, no writing
- Lesson pattern: target-language dialogue → instruction prompts learner to anticipate/produce phrases → graduated recall returns earlier material at widening intervals
- Anticipation principle: learners must produce the answer *before* hearing it, generating retrieval effort
- Core vocabulary: high-frequency functional vocabulary only
- Grammar introduced organically through usage, never explained as rules

**Session length:** 30 minutes; one lesson per day is the intended pace

**Effectiveness evidence:** Vesselinov et al. study (82 beginner participants): 83% who completed all 30 lessons improved oral proficiency by at least one level; 73% improved after eight or more hours of study (Wikipedia/Pimsleur).

**Strengths:** GIR is well-validated cognitively; the anticipation principle is more powerful than passive listening; audio-only means zero screen time required.

**Weaknesses:** No reading or writing; limited vocabulary breadth; expensive. 30 lessons covers roughly A1 in most languages.

#### 2c. Michel Thomas

**Core mechanic:** No memorisation, no homework, no writing. Grammar is built through guided sentence construction: the teacher presents a minimal building block, the learner constructs a sentence immediately, and understanding replaces rote memory.

**Quoted principle:** "What you understand, you know; and what you know, you don't forget."

**Structure:**
- Audio recordings of real teaching sessions with two students; listener is the "third student"
- Teacher presents the simplest possible building block (e.g. a cognate pair, a suffix that transfers across words)
- Student produces a sentence using that block immediately
- Next block is introduced only when the previous is absorbed
- Teacher takes responsibility for the learner's comprehension; stress is explicitly removed
- No fixed lesson length; the course is typically 8-20 hours total across multiple CDs/audio files

**Session length:** Informal; roughly 20-30 minutes per audio file

**Strengths:** Very low anxiety; the scaffolding from known to unknown is sophisticated; cognate exploitation speeds early Dutch progress for English speakers.

**Weaknesses:** Coverage is shallow; reviewers note the method breaks down past elementary level; no systematic vocabulary coverage; grammar is implied, never consolidated.

#### 2d. Teach Yourself (Complete series)

**Core mechanic:** Thematic units with a discovery approach. Each unit centres on a real-world situation and introduces vocabulary and grammar within that context.

**Structure:**
- Roughly 24-30 units per book, targeting A1 through B2
- Each unit: dialogue/text in target language → vocabulary list → grammar explanation (bite-sized, rarely more than one page) → exercises → cultural notes
- PPP framework (Presentation, Practice, Production) within each unit
- Audio covers pronunciation guide and all main dialogues
- Includes a basic reference dictionary
- Topics are thematic: greetings, family, shopping, transport, work, healthcare, etc.

**Session length:** No prescribed length; typically 45-90 minutes per unit when done thoroughly

**Strengths:** Comprehensive; covers all four skills; cultural context; works well as a standalone course for self-study.

**Weaknesses:** Grammar explanations can overwhelm beginners; relies on learner motivation to space their own review; no built-in SRS.

#### 2e. Glossika

**Core mechanic:** Mass sentence repetition with a spaced repetition algorithm. The learner hears a sentence in their native language, a pause, then the target language sentence read by a native speaker, then repeats aloud.

**Structure:**
- 3,000 sentences total, divided into three fluency levels (1,000 sentences each)
- Two pathways:
  - GSR (Glossika Spaced Repetition): 104 daily files; each introduces 10 new sentences and reviews 40 prior ones
  - GMS (Glossika Mass Sentences): 50-sentence batches in three audio variants (A, B, C)
- No grammar instruction; the brain is expected to induce rules from pattern exposure
- Sentences range from simple to moderately complex across the 3,000 total

**Session length:** 20-30 minutes per daily GSR file

**Strengths:** Native audio for every sentence; SRS is built in; genuine fluency-building through production volume.

**Weaknesses:** No grammar scaffolding can leave beginners adrift; repetition can feel mechanical; works best from A2 onwards when learners already have a basic grammar skeleton.

---

### 3. Audio-first vs text-first

Research does not support a pure audio-first or text-first mandate; it supports **integration**.

- Cambridge Core meta-analysis (Gains to L2 listeners, 2009): reading while listening outperforms listening-only for comprehension of short stories.
- ERIC study on audio-assisted reading: vocabulary gains from reading + listening to graded readers were 44% relative gain after 10 readers.
- Multisensory integrated model (visual + auditory + tactile) showed the most balanced improvements across all four skills: +32% listening, +33% speaking, +31% reading, +34% writing.
- Lightbown and Spada (summarised by Young): purely input-based approaches (Krashen's comprehensible input) produce real acquisition but leave systematic gaps; combining meaningful communication with explicit form instruction ("Get It Right in the End") produces better results than either alone.
- A 2025 Frontiers in Psychology paper ("Beyond comprehensible input") argues the CI hypothesis lacks sufficient neuro-ecological support and that multimodal context is the real vehicle for comprehensibility.

**Practical synthesis:** Start with audio+text together (not audio-only), make reading optional-but-encouraged for beginner drills, and increase the reading load as learners move from A1 toward B1.

---

### 4. Spiral curriculum and grammar scaffolding

Bruner's spiral curriculum (1960) proposes that any subject can be taught at any stage of development if the material is framed appropriately, and that learners should return to core concepts at increasing levels of complexity. The three principles:

1. **Continuity** - core ideas recur across the course
2. **Sequence** - each return builds on the previous encounter
3. **Integration** - concepts connect to each other rather than living in isolation

Applied to language learning:

- A learner first meets the Dutch perfect tense in a recognition exercise at A1 (passive encounter with "ik heb gegeten"). They see it again at A2 in a controlled exercise. At B1 they use it spontaneously in mixed-tense production.
- Vocabulary is not front-loaded in lists but introduced in context, then reinforced in new contexts across units. Frequency dictionaries (top 2,500 Dutch words) guide which items get the most spiralling.
- Grammar is introduced in a natural acquisition order where possible (SLA research shows learners acquire certain structures in fixed developmental sequences regardless of instruction order). Simple negation before subordinate-clause negation; regular past before strong/mixed past.

**Interleaved vs blocked practice.** Research (Bjork et al.; multiple SLA studies 2019-2024) shows that blocked practice (all drills on one grammar type) yields higher in-session accuracy but worse delayed-test retention. Interleaved practice (mixing grammar types mid-session) feels harder but produces better long-term transfer and is more representative of real-world language use where structures are not blocked by category.

**Spaced repetition meta-analysis (Kim 2022, Language Learning journal):** Across 48 experiments (N = 3,411), spacing had a medium-to-large effect on L2 learning. Longer spacing intervals outperformed shorter ones on delayed posttests. Equal and expanding spacing schedules were statistically equivalent. The effect held across vocabulary and grammar targets.

---

### 5. What a "lesson" looks like in each method

| Method | Session length | Primary activity | Grammar delivery | Vocabulary approach | Review mechanism |
|---|---|---|---|---|---|
| Assimil | 30-40 min | Read + listen + repeat dialogue | Footnote glosses | Contextual, in-dialogue | Built-in: active wave reviews passive wave |
| Pimsleur | 30 min | Listen + anticipate + produce aloud | None explicit; inductive | High-frequency core only | GIR schedule baked into lesson order |
| Michel Thomas | 20-30 min/file | Listen + produce sentences on cue | Scaffolded by teacher | Cognate-heavy; teacher curated | Teacher loops back informally |
| Teach Yourself | 45-90 min/unit | Read text → exercises | Explicit rule explanations | Thematic lists | None built in; learner-directed |
| Glossika | 20-30 min | Listen-repeat sentence pairs | None | Sentence-embedded, not listed | SRS algorithm |
| Duolingo | 5-15 min | Mixed drill types (translate, match, listen) | Tip cards, pop-up hints | Frequency-guided, gamified | SRS (half-life regression model) |

---

## Recommendations for Lekkertaal

Lekkertaal's Dutch A1-to-B1 path should borrow structural ideas from each method while avoiding their individual blind spots. The following are concrete recommendations keyed to the research above.

### R1. Use CEFR can-do descriptors as the skeleton, not grammar lists

Organise units around communicative goals ("can introduce yourself," "can ask for directions," "can describe a past event") drawn directly from the A1 and B1 CEFR descriptor sets. Every drill in a unit should serve one or more of those goals. This mirrors how Duolingo's CEFR-aligned checkpoint quizzes work.

**For Dutch A1 (approx. 8-10 units):** Greetings and self-introduction; daily routines and time; family and people; food and shopping; places and directions; travel and transport; work and study; weather and nature; health and body; basic opinions and preferences.

**For A2 (8-10 units):** Same topics at higher register, adding appointments, phone conversations, short written messages, and describing plans.

**For B1 (10-12 units):** News and current events; workplace communication; expressing opinions; narrating events in the past; hypothetical and conditional; formal written Dutch.

### R2. Adopt a frequency-first vocabulary strategy

Select the 2,500 most frequent Dutch words as the core vocabulary pool for A1-B1. Distribute them across units by topic relevance, but ensure the highest-frequency items (top 500) recur in multiple units regardless of topic. Use the spiral approach: introduce a word in context at A1, drill it actively at A2, and use it fluently at B1 without explicit prompting.

### R3. Introduce grammar through context first, then consolidate

Following Michel Thomas and Pimsleur's lead: present grammar via a sentence the learner encounters, not via a rule they must memorise. Add a short explicit explanation (Teach Yourself style, one paragraph maximum) *after* the learner has seen two or three examples. This mirrors the developmental sequencing principle: instruction works when it follows natural acquisition order.

Concrete Dutch A1 grammar order (research-aligned): present tense regular → question formation → negation (niet/geen) → plural nouns → definite/indefinite articles → basic modals → word-order inversion → simple adjective agreement.

### R4. Build an SRS-driven drill layer (Pimsleur/Glossika pattern)

Every vocabulary item and grammar structure enters a spaced repetition queue on first encounter. Review intervals should follow an expanding schedule (5 min → 1 day → 4 days → 2 weeks → 6 weeks → 6 months). Kim (2022) confirms longer intervals beat shorter ones on delayed tests; expanding intervals are equivalent to equal-spacing but feel better to learners.

Drill types within SRS sessions should be *interleaved* (not blocked by grammar type) to maximise transfer to real usage.

### R5. Integrate audio and text from day one (do not separate them)

Every new sentence or dialogue in a lesson should be presented as audio + text simultaneously. Audio-only mode can be offered as an optional "on the go" variant (Pimsleur-style) but should not be the default. The research on reading-while-listening shows consistent vocabulary and comprehension gains over either modality alone.

The anticipation principle from Pimsleur is worth adopting: show the Dutch sentence prompt, pause before revealing the translation or the answer, prompt the learner to produce a response. This retrieval effort strengthens the memory trace.

### R6. Use Assimil's passive-to-active arc at unit level

Within each unit, follow the Assimil timing principle: learners should encounter material passively (listen/read) before they are asked to produce it. The gap between passive exposure and production demand should be at least 2-3 sessions, not 0.

A concrete unit flow:
1. Session A: listen to a dialogue, read along, answer comprehension questions (passive)
2. Session B: drill vocabulary from the dialogue via matching/multiple-choice (recognition)
3. Session C: produce sentences using the vocabulary and grammar (production)
4. Session D (SRS): mixed interleaved recall of items from this unit and earlier units

### R7. Design lessons for 10-15 minutes, not 30+

Research on distributed practice shows that session spacing matters more than session length. Short, daily sessions outperform longer but less frequent ones for both vocabulary and grammar retention. Pimsleur's 30-minute sessions are at the upper bound of what attention research supports for a single focused practice block. Duolingo's 5-15 minute lessons reflect this finding in practice.

For Lekkertaal: target 10-15 minutes for a standard "drill session" and 20-25 minutes for a "lesson session" (new material + exercises). Streak mechanics already incentivise daily return; the lesson length should make the daily habit achievable.

### R8. Structure the A1-to-B1 path as three phases

Drawing on the vocabulary and hour estimates from the CEFR data:

| Phase | CEFR | Total hours | Lekkertaal units | Key milestone |
|---|---|---|---|---|
| Phase 1 | A1 | 0-100 hrs | 10 units × 8 lessons | Can handle basic transactional Dutch |
| Phase 2 | A2 | 100-200 hrs | 10 units × 8 lessons | Can navigate daily life in the Netherlands |
| Phase 3 | B1 | 200-400 hrs | 12 units × 10 lessons | Can participate in meetings, write emails |

Each lesson = one drill session (10-15 min) + one SRS review session (5-10 min). Total per unit = roughly 10-15 sessions.

### R9. Boss-fight scenarios as Michel Thomas "activation"

The existing roleplay/boss-fight mechanic is structurally analogous to Michel Thomas's activation phase: the learner must deploy acquired language in an unpredictable communicative situation where no specific vocabulary has been pre-selected for them. This is exactly the right pressure for B1 consolidation. Boss fights should be unlocked progressively, gating on completion of the relevant unit's production drills, not just the passive/recognition drills.

---

## Sources

1. **Council of Europe — CEFR Level Descriptions**
   https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions
   Official CEFR level descriptors A1-C2 from the Council of Europe, including the 2020 Companion Volume updates and the can-do descriptor search tool.

2. **Wikipedia — Common European Framework of Reference for Languages**
   https://en.wikipedia.org/wiki/Common_European_Framework_of_Reference_for_Languages
   Overview of the framework, learning-hour estimates by institution, and level competencies A1-C2.

3. **Dutch Online — From A1 to B1: What CEFR Levels Mean for Dutch Learners**
   https://www.dutch-online.com/blog/cefr-levels-dutch-a1-b1-expats
   Dutch-specific level descriptions with vocabulary counts, study-hour estimates, and communicative competencies per level.

4. **Assimil — The Assimil Method (official)**
   https://www.assimil.com/en/articles/5-the-assimil-method
   Primary source for the passive/active wave structure, session length (30-40 min), and the B2 timeline claim.

5. **Mezzoguild — The Most Honest Assimil Review**
   https://www.mezzoguild.com/assimil-review/
   Independent review of Assimil mechanics, the 50-lesson passive window, and the translation-based activation method.

6. **Pimsleur — Why Graduated Interval Recall Is the Key to Mastering a New Language**
   https://www.pimsleur.com/blog/why-graduated-interval-recall-is-the-key-to-mastering-a-new-language
   Pimsleur's own account of GIR intervals and the anticipation principle.

7. **Wikipedia — Pimsleur Language Programs**
   https://en.wikipedia.org/wiki/Pimsleur_Language_Programs
   Independent summary of the Pimsleur method, Vesselinov et al. effectiveness study, session length, and core principles.

8. **Michel Thomas — How It Works (official)**
   https://www.michelthomas.com/how-it-works/
   Primary source for the no-memorisation scaffolded sentence construction approach and its stress-free philosophy.

9. **The Language Closet — Teach Yourself Complete Series Review**
   https://thelanguagecloset.com/2020/09/19/%F0%9F%91%8F%F0%9F%8F%BB-method-%F0%9F%91%8F%F0%9F%8F%BB-review-teach-yourself-complete-series/
   Independent review of the Teach Yourself Complete series: thematic unit structure, bite-sized grammar, and audio integration.

10. **Rhapsody in Lingo — Glossika Method In-depth Review**
    https://rhapsodyinlingo.com/en/glossika-review/
    Detailed breakdown of Glossika's GSR and GMS pathways, 3,000-sentence total scope, and spaced repetition implementation.

11. **Kim, Y. & Webb, S. (2022) — The Effects of Spaced Practice on Second Language Learning: A Meta-Analysis**
    https://onlinelibrary.wiley.com/doi/abs/10.1111/lang.12479
    *Language Learning* journal meta-analysis of 48 experiments (N = 3,411): medium-to-large effect of spaced vs. massed practice; longer spacing beats shorter on delayed tests; equal and expanding spacing statistically equivalent.

12. **MostUsedWords — Dutch Frequency Dictionary**
    https://www.amazon.com/Dutch-Frequency-Dictionary-Vocabulary-Dutch-English/dp/9492637340
    Data source for the 2,500-word figure (92% spoken Dutch coverage) and A1-B1 vocabulary size estimates.

13. **Scott H. Young — What Does Research Say is the Best Way to Learn a Language?**
    https://www.scotthyoung.com/blog/2023/10/24/best-way-learn-language/
    Summary of Lightbown and Spada's SLA research: accuracy-first, input hypothesis, output/interaction hypothesis, developmental sequencing, and the "Get It Right in the End" balanced approach.

14. **ScienceDirect — Interleaved Practice Enhances Grammar Skill Learning (2024)**
    https://www.sciencedirect.com/article/abs/pii/S0959475224001725
    Confirms interleaved grammar practice produces better long-term retention than blocked practice despite feeling harder; real-world language use is inherently interleaved.

15. **Frontiers in Psychology — Beyond comprehensible input (2025)**
    https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1636777/full
    Neuro-ecological critique of Krashen's CI hypothesis; argues multimodal context drives comprehensibility more than input simplification alone.

16. **Tobian Language School — What Will I Learn in an A1 Dutch Course?**
    https://tobian-languageschool.com/what-will-i-learn-in-an-a1-dutch-course/
    Practical Dutch A1 grammar inventory and vocabulary domain breakdown for a standard A1 course.

17. **Wikipedia — Duolingo**
    https://en.wikipedia.org/wiki/Duolingo
    Overview of Duolingo's CEFR-aligned course structure, SRS implementation, and checkpoint quiz design.
